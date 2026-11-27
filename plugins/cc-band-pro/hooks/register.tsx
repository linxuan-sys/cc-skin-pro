import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, SessionContextUsage, Timer } from 'claude-code'

import type { DiffStep, Usage } from '../types'
import { FRAME_MS, drawPowerline, fitPills } from './bar'
import type { BarPress } from './bar'
import { DIFF_PANE, diffLines, drawDiff, isEditTool } from './diff'

const NO_USAGE: Usage = { contextPercent: null, contextTokens: null }

const frameAtom = atom({ plugin: 'cc-band-pro', key: 'frame' } as const, 0)
const usageAtom = atom({ plugin: 'cc-band-pro', key: 'usage' } as const, NO_USAGE)
const diffStepsAtom = atom({ plugin: 'cc-band-pro', key: 'diffSteps' } as const, [] as DiffStep[])
const diffIndexAtom = atom({ plugin: 'cc-band-pro', key: 'diffIndex' } as const, 0)

/** Whether the band is shown; `/band off` hides it and the choice survives sessions. */
const BAND_ON_KEY = 'band-on'
let bandOn = true

/**
 * The command each block runs; the diff block opens this plugin's own replay
 * pane.
 */
const TARGETS: Readonly<Record<Exclude<BarPress, 'diff' | 'pi'>, string>> = {
  after: 'after',
  tree: 'filetree',
  mark: 'bookmarks',
  usage: 'ctx',
}

/** Moves the spinner while a main-thread turn runs. */
let animation: Timer | undefined
/** The edits this turn has made so far; they become the diff pane's steps when it ends. */
let pendingDiffs: DiffStep[] = []

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
const readUsage = async ($: EngineInterface): Promise<Usage | undefined> => {
  const maybe = await $.session.usage({ breakdown: 'summary' }).catch(() => undefined)
  if (maybe === undefined) {
    return undefined
  }

  return { contextPercent: contextPercent(maybe.context), contextTokens: maybe.context.tokens ?? null }
}

/** Reads in what the bar shows: how full the context is. */
const setUp = async ($: EngineInterface) => {
  const usage = await readUsage($)
  await update($, usageAtom, current => ({ ...current, ...usage }))
}

/** Windows Terminal and Herdr keep the session busy, so a plugin-run command queues forever there; fill it for Enter instead. */
const needsMouseInput = async ($: EngineInterface): Promise<boolean> => {
  const [wt, program] = await Promise.all([
    $.env.get('WT_SESSION'),
    $.env.get('TERM_PROGRAM'),
  ])
  const name = program?.toLowerCase()

  return wt !== undefined || name === 'herdr' || name === 'windows_terminal'
}

/** Opens the diff pane on the last turn's edits, at the first step; a surface that cannot seat it says so in a toast. */
const openDiff = async ($: EngineInterface): Promise<void> => {
  void update($, diffIndexAtom, () => 0)
  const opened = await $.ui.open({ id: DIFF_PANE, title: 'Diff', focus: true, closeOnEscape: true })
  if (!opened.isPlaced) {
    $.ui.toast(`Diff pane is waiting: ${opened.reason}`)

    return
  }
  await $.ui.focus({ requestId: DIFF_PANE, key: 'next' }).catch(() => undefined)
}

/**
 * What a press on the bar does: the diff opens here at once; in a terminal
 * whose session never idles the command is filled for Enter, otherwise the
 * target's bridge opens it now.
 */
const pressBar = async ($: EngineInterface, press: BarPress): Promise<void> => {
  if (press === 'diff') {
    await openDiff($)

    return
  }
  if (await needsMouseInput($)) {
    await $.prompt.fill({ text: `/${press === 'pi' ? 'pi-pane' : TARGETS[press]}`, mode: 'replace' })

    return
  }
  if (press === 'pi') {
    try {
      await $.pi.open()
    } catch {
      // pi 插件没装：没有可开的 pane
    }

    return
  }
  try {
    if (press === 'after') {
      await $.after.open()
    } else if (press === 'tree') {
      await $.filetree.open()
    } else if (press === 'mark') {
      await $.bookmarks.open()
    } else {
      await $.sessionMeter.open()
    }
  } catch {
    // 对应插件没装：没有可开的 pane
  }
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
 * The steps a tool call makes: one for an Edit, one for a Write. A Write reads
 * the file as it stands before the tool runs, so it diffs against what was
 * there.
 */
const stepsFor = async ($: EngineInterface, e: Record<string, unknown>): Promise<DiffStep[]> => {
  const cwd = await $.session.cwd().catch(() => '')
  const file = relPath(cwd, e.file_path)

  if (e.tool === 'Edit') {
    return [{ tool: 'Edit', file, diff: diffLines(e.old_string, e.new_string), note: e.replace_all === true ? 'replace all' : '' }]
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
    await $.command.register({
      name: 'band',
      description: 'Show or hide the status band',
      argumentHint: 'on | off',
      immediate: true,
    })
    await $.command.register({
      name: 'replay',
      description: 'Open the replay pane',
      immediate: true,
    })
    bandOn = (await $.store.get(BAND_ON_KEY).catch(() => undefined)) !== false
    await setUp($).catch(() => undefined)

    return next(e)
  })

  on('command.run', { command: 'band' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    if (arg !== 'on' && arg !== 'off') {
      return { text: 'Usage: /band on | off' }
    }
    bandOn = arg === 'on'
    await $.store.set(BAND_ON_KEY, bandOn).catch(() => undefined)
    $.ui.invalidate('ui.render')
    return { text: `band ${arg}` }
  })

  on('command.run', { command: 'replay' }, $ => {
    void openDiff($).catch(() => undefined)
    return {}
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
    await setUp($)

    return next(e)
  }).catch(($, e, next) => next(e))

  // The band: the bar on top of whatever the plugins beneath draw, so the skins band and the rest stay.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const below = await next(e)
    try {
      if (!bandOn) {
        return below
      }
      const elements = $.ui.resolve(e)
      const pills = fitPills(
        {
          usage: await read($, usageAtom),
          diffCount: (await read($, diffStepsAtom)).length,
          isWorking: e.props.isWorking,
          frame: await read($, frameAtom),
        },
        e.props.bodyColumns,
      )
      const { Box } = elements

      const tree = (
        <Box flexDirection="column">
          {drawPowerline(elements, pills, press => void pressBar($, press).catch(() => undefined))}
          {below}
        </Box>
      )

      return tree
    } catch {
      return below
    }
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'Pane', requestId: DIFF_PANE }, async ($, e) => {
    const steps = await read($, diffStepsAtom)

    return drawDiff(
      $.ui.resolve(e),
      {
        steps,
        index: await read($, diffIndexAtom),
      },
      {
        // clamped, so Next on the last step and Prev on the first stay put
        go: index => void update($, diffIndexAtom, () => Math.max(0, Math.min(index, steps.length - 1))),
        close: () => void $.ui.close({ id: DIFF_PANE }).catch(() => undefined),
      },
    )
  })
}
