import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, SessionContextUsage, Timer } from 'claude-code'

import type { DiffStep, Usage } from '../types'
import { FRAME_MS, drawPowerline, fitPills } from './bar'
import type { BarPress } from './bar'
import { DIFF_PANE, diffLines, drawDiff, isEditTool } from './diff'

const NO_USAGE: Usage = { model: null, contextPercent: null, contextTokens: null }

const frameAtom = atom({ plugin: 'cc-band-pro', key: 'frame' } as const, 0)
const usageAtom = atom({ plugin: 'cc-band-pro', key: 'usage' } as const, NO_USAGE)
const effortAtom = atom({ plugin: 'cc-band-pro', key: 'effort' } as const, null as string | null)
const diffStepsAtom = atom({ plugin: 'cc-band-pro', key: 'diffSteps' } as const, [] as DiffStep[])
const diffIndexAtom = atom({ plugin: 'cc-band-pro', key: 'diffIndex' } as const, 0)

/** The thinking block's two crab thumbnails, read once per load; undefined when an asset is missing. */
let crabPngs: { idle: string; typing: string } | null = null
/** Set once a read came up empty, so a missing asset is not read again every frame. */
let crabMissing = false
const readCrab = async ($: EngineInterface): Promise<{ idle: string; typing: string } | undefined> => {
  if (crabPngs !== null) {
    return crabPngs
  }
  if (crabMissing) {
    return undefined
  }
  const read = (name: string): Promise<string> =>
    $.fs.read(`${$.plugin.root}/assets/${name}`, { as: 'bytes' }).then(file => file.base64)
  const [idle, typing] = await Promise.all([read('crab.png').catch(() => ''), read('crab-typing.png').catch(() => '')])
  if (idle === '' || typing === '') {
    crabMissing = true
    return undefined
  }

  crabPngs = { idle, typing }

  return crabPngs
}

/**
 * Hosts a terminal's graphics escapes never pass through — tmux, an editor's
 * `:terminal` — sniffed once per session from the environment, so the crab is
 * not drawn into a host that eats it. Everywhere else the engine's alt fallback
 * has the last word.
 */
let hasGraphics = true
const sniffGraphics = async ($: EngineInterface): Promise<void> => {
  const tmux = await $.env.get('TMUX')
  const nvim = await $.env.get('NVIM')
  const vimTerminal = await $.env.get('VIM_TERMINAL')
  hasGraphics = tmux === undefined && nvim === undefined && vimTerminal === undefined
}

/**
 * What a press on a block runs: another plugin's own slash command, exactly as
 * if it were typed, so each pane is kept in its own plugin. The diff block is
 * the one that opens this plugin's own pane.
 */
type Pane = { id: string; title: string | ((cwd: string) => string); focus?: boolean; closeOnEscape?: boolean }
type Target = { command: string; plugin: string; pane?: Pane }
const TARGETS: Readonly<Record<Exclude<BarPress, 'diff'>, Target>> = {
  // Each of these keeps the state its pane draws from, so opening it by its id
  // comes up whole without the command: find-model reads its list in at
  // session.start, filetree keeps its tree following the cwd, session-meter
  // keeps its reading from session.measure, after its queue in state, and
  // transcript-bookmarks its list from $.store at session.start.
  after: {
    command: 'after',
    plugin: 'after',
    pane: { id: 'after', title: 'After', focus: true, closeOnEscape: true },
  },
  model: {
    command: 'find-model',
    plugin: 'find-model',
    pane: { id: 'find-model', title: 'Find model', focus: true, closeOnEscape: true },
  },
  tree: {
    command: 'filetree',
    plugin: 'filetree',
    pane: { id: 'filetree', title: cwd => `Files: ${cwd.split('/').pop() || cwd}`, focus: true },
  },
  mark: {
    command: 'bookmarks',
    plugin: 'transcript-bookmarks',
    pane: { id: 'bookmarks', title: 'Bookmarks', focus: true, closeOnEscape: true },
  },
  usage: { command: 'ctx', plugin: 'session-meter', pane: { id: 'ctx', title: 'Session' } },
}

/** The friendly names the settings' modelPicker gives the models, read as a session starts. */
let labels: Record<string, string> = {}
/** Moves the spinner while a main-thread turn runs. */
let animation: Timer | undefined
/** The edits this turn has made so far; they become the diff pane's steps when it ends. */
let pendingDiffs: DiffStep[] = []

/** The session's model; null when it cannot be read. */
const readModel = async ($: EngineInterface): Promise<string | null> => {
  try {
    return await $.session.model()
  } catch {
    return null
  }
}

/** The effort `/effort` set, from the config rows; null for none (the model's own default). */
const readEffort = async ($: EngineInterface): Promise<string | null> => {
  try {
    const row = (await $.config.list()).find(one => one.key === 'effort')
    const value = typeof row?.value === 'string' ? row.value.trim() : ''

    return value === '' || value === 'auto' ? null : value
  } catch {
    return null
  }
}

/** The friendly name of each model the settings' modelPicker lists, where it gives one. */
const readLabels = async ($: EngineInterface): Promise<Record<string, string>> => {
  try {
    const picker = (await $.settings.read({ key: 'modelPicker' })) as { options?: unknown } | undefined
    const rows = Array.isArray(picker?.options) ? (picker.options as Array<{ model?: unknown; label?: unknown } | null>) : []
    const found: Record<string, string> = {}
    for (const row of rows) {
      const model = typeof row?.model === 'string' ? row.model.trim() : ''
      const label = typeof row?.label === 'string' ? row.label.trim() : ''
      if (model !== '' && label !== '') {
        found[model] = label
      }
    }

    return found
  } catch {
    return {}
  }
}

/**
 * How full the context is, measured as skins and `/context` measure it: against
 * the window auto-compaction runs at where that is smaller than the model's own,
 * so the yellow and red come before the engine compacts on its own. The plain
 * `percent` is against the model's whole window, which reads lower.
 */
const contextPercent = (context: SessionContextUsage): number | null => {
  const compactsAt = context.breakdown?.rawMaxTokens
  if (context.tokens !== undefined && compactsAt !== undefined && compactsAt > 0 && compactsAt < context.window) {
    return Math.min(100, Math.round((context.tokens / compactsAt) * 100))
  }

  return context.percent ?? null
}

/** How full the context is; absent when the session cannot say. `session.measure`'s own context carries no breakdown. */
const readUsage = async ($: EngineInterface): Promise<Omit<Usage, 'model'> | undefined> => {
  const maybe = await $.session.usage({ breakdown: 'summary' }).catch(() => undefined)
  if (maybe === undefined) {
    return undefined
  }

  return { contextPercent: contextPercent(maybe.context), contextTokens: maybe.context.tokens ?? null }
}

/** Reads in what the bar shows: the model's names first, so the redraw the writes cause has them. */
const setUp = async ($: EngineInterface) => {
  labels = await readLabels($)
  const model = await readModel($)
  const usage = await readUsage($)
  await update($, usageAtom, current => ({ ...current, ...usage, model: model ?? current.model }))
  const effort = await readEffort($)
  if (effort !== null) {
    await update($, effortAtom, () => effort)
  }
}

/**
 * Runs another plugin's command on a timer, in a dispatch of its own: work a
 * press starts ends with the press, and a command waits its turn while Claude
 * works unless its plugin made it immediate. A plugin that is off says so.
 */
const runCommand = ($: EngineInterface, target: Target) => {
  $.clock.after(1, () =>
    $.command.run({ command: target.command }).catch((error: unknown) => {
      const why = error instanceof Error ? error.message : String(error)
      $.ui.toast(`/${target.command} did not run (is ${target.plugin} on?): ${why}`)
    }),
  )
}

/** Opens the diff pane on the last turn's edits, at the first step; a surface that cannot seat it says so in a toast. */
const openDiff = async ($: EngineInterface): Promise<void> => {
  void update($, diffIndexAtom, () => 0)
  const opened = await $.ui.open({ id: DIFF_PANE, title: 'Diff', focus: true, closeOnEscape: true })
  if (!opened.isPlaced) {
    $.ui.toast(`Diff pane is waiting: ${opened.reason}`)
  }
}

/** Opens another plugin's pane by its id, mid-turn, when its own render hook answers it. */
const openPaneNow = async ($: EngineInterface, target: Target): Promise<boolean> => {
  const pane = target.pane
  if (pane === undefined) {
    return false
  }
  const { id, focus, closeOnEscape } = pane
  const title = typeof pane.title === 'string' ? pane.title : pane.title(await $.session.cwd().catch(() => ''))
  const opened = await $.ui.open({ id, title, focus, closeOnEscape }).catch(() => undefined)

  return opened?.isPlaced === true
}

/**
 * What a press on the bar does: the diff opens here at once, the rest run their
 * own plugins' commands. A pane that draws from state its plugin already keeps
 * opens straight away and leaves no line in the conversation, mid-turn or not;
 * the other commands wait for the turn to end, as one run from a hook does, so a
 * press while Claude works says it is queued.
 */
const onBarPress = ($: EngineInterface, press: BarPress, isWorking: boolean) => {
  if (press === 'diff') {
    void openDiff($).catch(() => undefined)

    return
  }
  const target = TARGETS[press]
  void openPaneNow($, target).then(now => {
    if (now) {
      return
    }
    if (isWorking) {
      $.ui.toast(`/${target.command} queued: it opens when this turn ends`)
    }
    runCommand($, target)
  })
}

/** A path under the session's folder as relative to it; any other as it is. */
const relPath = (cwd: string, path: unknown): string => {
  const full = typeof path === 'string' ? path : ''
  if (full === '') {
    return '(unknown file)'
  }

  return cwd !== '' && full.startsWith(`${cwd}/`) ? full.slice(cwd.length + 1) : full
}

/**
 * The steps a tool call makes: one for an Edit or a Write, one per edit of a
 * MultiEdit. A Write reads the file as it stands before the tool runs, so it
 * diffs against what was there.
 */
const stepsFor = async ($: EngineInterface, e: Record<string, unknown>): Promise<DiffStep[]> => {
  const cwd = await $.session.cwd().catch(() => '')
  const file = relPath(cwd, e.file_path)

  if (e.tool === 'Edit') {
    return [{ tool: 'Edit', file, diff: diffLines(e.old_string, e.new_string), note: e.replace_all === true ? 'replace all' : '' }]
  }
  if (e.tool === 'MultiEdit' && Array.isArray(e.edits)) {
    const edits = e.edits as Array<{ old_string?: unknown; new_string?: unknown } | null>

    return edits.map((edit, k) => ({
      tool: 'MultiEdit',
      file,
      diff: diffLines(edit?.old_string, edit?.new_string),
      note: `edit ${k + 1} of ${edits.length}`,
    }))
  }
  if (e.tool === 'Write') {
    let before = ''
    let isNew = true
    try {
      const path = typeof e.file_path === 'string' ? e.file_path : ''
      if (path !== '' && (await $.fs.exists(path))) {
        const text: unknown = await $.fs.read(path)
        before = typeof text === 'string' ? text : ''
        isNew = false
      }
    } catch {
      // unreadable: show it as a new file
    }

    return [{ tool: 'Write', file, diff: diffLines(before, e.content), note: isNew ? 'new file' : 'rewrite' }]
  }

  return []
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await sniffGraphics($)
    await setUp($).catch(() => undefined)

    return next(e)
  })

  // A /clear or a resume ends this session: the host empties every plugin's $.state with it (these atoms included,
  // back to their defaults), so only the turn's edits, held in this module, are dropped here.
  on('session.end', async ($, e, next) => {
    animation?.cancel()
    animation = undefined
    if (e.reason === 'resume' || e.reason === 'clear') {
      pendingDiffs = []
    }

    return next(e)
  }).catch(($, e, next) => next(e))

  // The spinner turns from the moment a main-thread turn starts; a subagent's turn carries its agentId.
  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) {
      pendingDiffs = []
      animation?.cancel()
      animation = $.clock.every(FRAME_MS, () => void update($, frameAtom, frame => frame + 1))
    }

    return next(e)
  }).catch(($, e, next) => next(e))

  // Each request says which model and effort it ran on: the model block follows them.
  on('turn.step', async function* ($, e, next) {
    try {
      if (e.agentId === undefined) {
        const effort = typeof e.effort === 'string' ? e.effort : undefined
        if (effort !== undefined && (await read($, effortAtom)) !== effort) {
          await update($, effortAtom, () => effort)
        }
        const model = e.model
        if ((await read($, usageAtom)).model !== model) {
          await update($, usageAtom, usage => ({ ...usage, model }))
        }
      }
    } catch {
      // The bar shows them from the next request.
    }

    return yield* next(e)
  })

  // An edit is diffed before it runs (a Write against the file as it stands) and kept once it went through.
  on('tool.call', async ($, e, next) => {
    if (e.agentId !== undefined || !isEditTool(e.tool)) {
      return next(e)
    }
    let steps: DiffStep[] = []
    try {
      steps = await stepsFor($, e as unknown as Record<string, unknown>)
    } catch {
      // Recording never stops the edit.
    }
    const result = await next(e)
    if (result.deny === undefined && result.isError !== true) {
      pendingDiffs = [...pendingDiffs, ...steps]
    }

    return result
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    if (e.agentId !== undefined) {
      return next(e)
    }
    // The turn's edits become the diff pane's steps; a turn without edits leaves the last ones.
    const edits = pendingDiffs
    pendingDiffs = []
    if (edits.length > 0) {
      await update($, diffStepsAtom, () => edits)
      await update($, diffIndexAtom, () => 0)
    }
    animation?.cancel()
    animation = undefined
    await update($, frameAtom, () => 0)

    return next(e)
  }).catch(($, e, next) => next(e))

  on('session.measure', async ($, e, next) => {
    const model = await readModel($)
    const usage = await readUsage($)
    await update($, usageAtom, current => ({ ...current, ...usage, model: model ?? current.model }))

    return next(e)
  }).catch(($, e, next) => next(e))

  // A /model or a pick in /find-model shows at once, not with the next request.
  on('config.set', { key: 'model' }, async ($, e, next) => {
    const result = await next(e)
    const model = await readModel($)
    await update($, usageAtom, current => ({ ...current, model: model ?? current.model }))

    return result
  }).catch(($, e, next) => next(e))

  on('config.set', { key: 'effort' }, async ($, e, next) => {
    const result = await next(e)
    const effort = await readEffort($)
    await update($, effortAtom, () => effort)

    return result
  }).catch(($, e, next) => next(e))

  // The band: the bar on top of whatever the plugins beneath draw, so the skins band and the rest stay.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const below = await next(e)
    if (e.props.hasSurvey) {
      return below
    }
    const elements = $.ui.resolve(e)
    // The thinking block draws the crab where the surface offers pictures and
    // no escape-eating host wraps the terminal; elsewhere it keeps the glyph.
    const crab = hasGraphics && 'Image' in elements ? await readCrab($) : undefined
    const pills = fitPills(
      {
        usage: await read($, usageAtom),
        effort: await read($, effortAtom),
        labels,
        diffCount: (await read($, diffStepsAtom)).length,
        isWorking: e.props.isWorking,
        frame: await read($, frameAtom),
      },
      e.props.bodyColumns,
      crab,
    )
    const { Box } = elements

    return (
      <Box flexDirection="column">
        {drawPowerline(elements, pills, press => onBarPress($, press, e.props.isWorking))}
        {below}
      </Box>
    )
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'Pane', requestId: DIFF_PANE }, async ($, e) => {
    const steps = await read($, diffStepsAtom)

    return drawDiff(
      $.ui.resolve(e),
      {
        steps,
        index: await read($, diffIndexAtom),
        columns: e.props.bodyColumns,
        bodyRows: e.props.scroll.bodyRows,
      },
      {
        // clamped, so Next on the last step and Prev on the first stay put
        go: index => void update($, diffIndexAtom, () => Math.max(0, Math.min(index, steps.length - 1))),
        close: () => void $.ui.close({ id: DIFF_PANE }).catch(() => undefined),
      },
    )
  })
}
