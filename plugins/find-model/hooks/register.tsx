import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { ModelState } from '../types'
import type { RowSpec, RowsProps, Seg } from './rows'

const PANE = 'find-model'

/** The levels `/effort` takes; `auto` goes back to the model's own. */
const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max', 'auto'] as const

/** How close two presses must be to read as one double click, in ms. */
const DOUBLE_MS = 450

/** The purple of the row numbers, the green of the tick, the accent of the caret. */
const NUMBER_COLOR = '#bb9af7'
const TICK_COLOR = '#9ece6a'
const ACCENT = '#7AA2F7'
const MUTED = '#444B5A'

/**
 * The rows the pane spends before the list: the heading, the search box with its
 * border and margins, the effort heading and its one row, and the hint. Kept
 * exact: a tree taller than the pane's window would make the engine scroll a
 * second time, and the wheel would fight it.
 */
const CHROME = 9

/** The fewest rows the list keeps, as the file tree keeps its own. */
const MIN_ROWS = 5

/**
 * How often the pane asks what the session runs while it shows: `/model` and
 * `/effort` run from the composer too, and their switch has to show up here.
 */
const WATCH_MS = 1500

const view = atom(
  { plugin: 'find-model', key: 'view' } as const,
  { current: '', cursor: '', filter: '', effort: null, models: [], labels: {}, scroll: null } as ModelState,
)

/** Remembers the last press to tell a single click from a double click. */
let lastPress = { key: '', at: 0 }

/** The last window the render laid out: `from` its first row, `room` its rows, `max` its last top. */
let win = { from: 0, room: MIN_ROWS, max: 0 }

/**
 * The models `/model` offers: the settings' `modelPicker` rows, read from the
 * merged settings, so this is the very list `/model` shows — a gateway's models,
 * not the built-in lineup. Falls back to the Model row's own choices.
 */
const readModels = async ($: EngineInterface): Promise<{ models: string[]; labels: Record<string, string> }> => {
  const empty = { models: [] as string[], labels: {} as Record<string, string> }
  try {
    const all = (await (($ as any).settings.read)()) as Record<string, unknown> | undefined
    const picker = all?.['modelPicker'] as { options?: { model?: unknown; label?: unknown }[] } | undefined
    const rows = Array.isArray(picker?.options) ? picker.options : []
    const models: string[] = []
    const labels: Record<string, string> = {}
    for (const row of rows) {
      const model = typeof row?.model === 'string' ? row.model.trim() : ''
      if (model === '') continue
      models.push(model)
      const label = typeof row?.label === 'string' ? row.label.trim() : ''
      if (label !== '') labels[model] = label
    }
    if (models.length > 0) return { models, labels }

    const configRow = (await $.config.list()).find(one => one.key === 'model')
    const options = Array.isArray(configRow?.options) ? (configRow.options as string[]) : []
    if (options.length > 0) return { models: options, labels: {} }
  } catch {
    return empty
  }
  return empty
}

/** The last path segment of an id, for a model the settings give no label. */
const friendly = (id: string): string => {
  const slash = id.lastIndexOf('/')
  return slash !== -1 && slash + 1 < id.length ? id.slice(slash + 1) : id
}

/** The models that hold the filter, matched against id or label; spaces don't
 * count, so `deepseekv4.1` still finds "DeepSeek V4.1". */
const matches = (state: ModelState): string[] => {
  const query = state.filter.trim().toLowerCase().replace(/\s+/g, '')
  if (query === '') return [...state.models]
  return state.models.filter(id => {
    if (id.toLowerCase().replace(/\s+/g, '').includes(query)) return true
    const label = state.labels[id]
    return label !== undefined && label.toLowerCase().replace(/\s+/g, '').includes(query)
  })
}

/** The current effort, as the config reports it; null when the model's own. */
const currentEffort = async ($: EngineInterface): Promise<string | null> => {
  try {
    const row = (await $.config.list()).find(one => one.key === 'effort')
    return typeof row?.value === 'string' && row.value !== '' ? row.value : null
  } catch {
    return null
  }
}

/** Switches the model, exactly as `/model <model>` does: this session. */
const pickModel = async ($: EngineInterface, value: string) => {
  try {
    await $.command.run({ command: 'model', args: value })
  } catch {
    $.ui.toast(`Model stays: /model ${value} can't run right now`)
    return
  }
  await update($, view, v => ({ ...v, current: value, cursor: value }))
}

/** Sets the effort, as `/effort` does. */
const pickEffort = async ($: EngineInterface, level: string) => {
  try {
    await $.command.run({ command: 'effort', args: level })
  } catch {
    $.ui.toast(`Effort stays: /effort ${level} can't run right now`)
    return
  }
  await update($, view, v => ({ ...v, effort: level === 'auto' ? null : level }))
}

/** Walks the caret by a delta, as the file tree walks its rows; the window recentres on it. */
const moveCaret = async ($: EngineInterface, delta: number) => {
  const state = await read($, view)
  const list = matches(state)
  if (list.length === 0) return
  const at = Math.max(0, list.indexOf(state.cursor))
  const next = Math.max(0, Math.min(list.length - 1, at + delta))
  const cursor = list[next]
  if (cursor === undefined) return
  await update($, view, v => ({ ...v, cursor, scroll: null }))
}

/** The timer that keeps the pane in step with the session while it shows. */
let watch: { cancel: () => void } | null = null

/**
 * Brings the pane up to date with what the session runs: `/model` and `/effort`
 * run from the composer as well, and the engine keeps no event for either, so
 * the pane asks. The caret follows the model when it was sitting on it.
 */
const sync = async ($: EngineInterface) => {
  const state = await read($, view)
  const said = await $.session.model().catch(() => '')
  // A session that says nothing keeps the model the pane already shows.
  const current = typeof said === 'string' && said !== '' ? said : state.current
  const effort = await currentEffort($)
  if (current === state.current && effort === state.effort) return
  await update($, view, v => ({
    ...v,
    current,
    cursor: v.cursor === v.current || !v.models.includes(v.cursor) ? current : v.cursor,
    effort,
  }))
}

/** Asks while the pane shows; stopped by the close, or by the pane going away. */
const startWatch = ($: EngineInterface) => {
  watch?.cancel()
  watch = $.clock.every(WATCH_MS, () => {
    void (async () => {
      const mine = (await $.ui.panes().catch(() => [])).find(p => p.id === PANE)
      if (!mine?.isShown) {
        watch?.cancel()
        watch = null
        return
      }
      await sync($).catch(() => undefined)
    })()
  })
}

/** Opens the pane and hands the keyboard to `key`, as the file tree's `focusPane` does. */
const focusPane = ($: EngineInterface, key: string) =>
  void $.ui
    .open({ id: PANE, title: 'Find model', focus: true })
    .then(() => $.ui.focus({ requestId: PANE, key }))
    .catch(() => undefined)

/** Opens the picker: the list and effort read at once and held in state. */
const openPicker = async ($: EngineInterface) => {
  const { models, labels } = await readModels($)
  const current = await $.session.model().catch(() => '')
  const effort = await currentEffort($)
  await update($, view, () => ({ current, cursor: current, filter: '', effort, models, labels, scroll: null }))
  lastPress = { key: '', at: 0 }
  win = { from: 0, room: MIN_ROWS, max: 0 }

  const opened = await $.ui.open({ id: PANE, title: 'Find model', focus: true, closeOnEscape: true })
  startWatch($)

  return opened
}

/** Whether `warm` has run since this module loaded: one read a load, not one a frame. */
let warmed = false

/**
 * Reads the list into the pane's state without opening it, so another plugin
 * (a bar's model block) can open this pane by its id and find it drawn. The
 * list is the settings' own and does not change in a session; the model and
 * effort `sync` keeps current once the pane shows. A no-op once it has a list.
 */
const warm = async ($: EngineInterface) => {
  if (warmed) return
  warmed = true
  if ((await read($, view)).models.length > 0) return
  const { models, labels } = await readModels($)
  if (models.length === 0) return
  const current = await $.session.model().catch(() => '')
  const effort = await currentEffort($)
  await update($, view, v =>
    v.models.length > 0 ? v : { ...v, models, labels, current, cursor: v.cursor === '' ? (current !== '' ? current : (models[0] ?? '')) : v.cursor, effort },
  )
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'find-model',
      description: 'Pick a model in the sidebar: the list /model shows, with search and the effort levels',
      immediate: true,
    })
    // Read in now, so the pane opens whole when another plugin opens it by id.
    await warm($).catch(() => undefined)
    return next(e)
  })

  on('command.run', { command: 'find-model' }, async ($, e) => {
    const mine = (await $.ui.panes().catch(() => [])).find(p => p.id === PANE)
    if (mine?.isShown && !(e.args ?? '').trim()) {
      watch?.cancel()
      watch = null
      await $.ui.close({ id: PANE }).catch(() => undefined)
      return { text: 'Find model closed.' }
    }
    const opened = await openPicker($)
    return { text: opened.isPlaced ? 'Find model opened.' : `Find model pane is waiting: ${opened.reason}` }
  })

  // The list's presses mark a row, a quick second press switches; its keys walk.
  on('ui.message', { requestId: PANE }, async ($, e) => {
    const data = (e.data ?? {}) as { press?: string; key?: string; scrollTo?: number }
    const state = await read($, view)

    if (typeof data.scrollTo === 'number') {
      const to = Math.round(Math.max(0, Math.min(1, data.scrollTo)) * win.max)
      if (to !== state.scroll) await update($, view, v => ({ ...v, scroll: to }))
      return {}
    }

    const list = matches(state)
    if (typeof data.press === 'string' && list.includes(data.press)) {
      const now = await $.clock.now()
      const isDouble = lastPress.key === data.press && now - lastPress.at < DOUBLE_MS
      lastPress = { key: isDouble ? '' : data.press, at: now }
      if (isDouble) await pickModel($, data.press)
      else await update($, view, v => ({ ...v, cursor: data.press }))
      return {}
    }

    if (typeof data.key === 'string') await walk($, data.key, list)
    return {}
  })

  // The wheel moves the window alone, the caret staying where the person put it;
  // the scroll keys walk the caret, as j/k do. The wheel is the one carrying the
  // cell it was over, which is how the two are told apart.
  on('ui.scroll', { component: 'Pane', requestId: PANE }, async ($, e, next) => {
    if (e.origin.kind !== 'person') return next(e)
    const state = await read($, view)
    if (e.pointer !== undefined) {
      const by = Math.sign(e.by) * Math.max(3, Math.abs(e.by))
      const to = Math.max(0, Math.min(win.max, (state.scroll ?? win.from) + by))
      if (to !== state.scroll) await update($, view, v => ({ ...v, scroll: to }))
      return {}
    }
    const list = matches(state)
    const at = Math.max(0, list.indexOf(state.cursor))
    const dir = Math.sign(e.by)
    if (dir === 0 || list.length === 0) return {}
    const step = Math.abs(e.by) <= 1 ? dir : dir * Math.max(1, win.room - 1)
    const cursor = list[Math.max(0, Math.min(list.length - 1, at + step))] ?? state.cursor
    if (cursor !== state.cursor) await update($, view, v => ({ ...v, cursor, scroll: null }))
    return {}
  }).catch(($, e, next) => next(e))

  // The arrows move the focus ring, not the list: the ring is aimed at the hidden
  // buttons before and after the list, and the caret walks instead while the ring
  // stays where the person left it.
  on('ui.focus', { component: 'Pane', requestId: PANE }, async ($, e, next) => {
    if (e.origin.kind !== 'person') return next(e)
    const by =
      e.element === 'hk-nav-up' || e.element === 'hk-filter-up'
        ? -1
        : e.element === 'hk-nav-down' || e.element === 'hk-filter-down'
          ? 1
          : 0
    if (by === 0) return next(e)
    await moveCaret($, by)
    return {}
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e, next) => {
    // The two surfaces that draw a `Client`, as the file tree draws on; anywhere
    // else the engine keeps its own pane rather than an empty one.
    if (e.surface !== 'terminal' && e.surface !== 'desktop') return next(e)
    const { Box, Text, Button, Input, Client } = $.ui.resolve(e)
    // Opened by its id rather than by its command, the list may not be in yet,
    // and the watcher that keeps a shown pane current was never started.
    await warm($).catch(() => undefined)
    if (watch === null) startWatch($)
    const state = await read($, view)
    const list = matches(state)

    // The caret is the cursor, or the current model, or the top of the list.
    const anchor = list.includes(state.cursor) ? state.cursor : list.includes(state.current) ? state.current : (list[0] ?? '')
    const at = Math.max(0, list.indexOf(anchor))

    // The rows the pane has, less its own fixed parts: the tree must not outgrow
    // the window the engine gives the pane, or it would scroll a second time.
    const body = e.props.scroll?.bodyRows ?? 40
    const room = Math.max(MIN_ROWS, body - CHROME)
    const max = Math.max(0, list.length - room)
    // The window follows the caret, centred, unless the person scrolled it somewhere.
    let from = Math.max(0, Math.min(at - Math.floor(room / 2), max))
    if (state.scroll !== null) from = Math.max(0, Math.min(state.scroll, max))
    win = { from, room, max }

    const shown = list.slice(from, from + room)
    const barSize = Math.max(1, Math.round((room * room) / Math.max(1, list.length)))
    const bar: RowsProps['bar'] =
      list.length > room
        ? { pos: max ? Math.round((from / max) * (room - barSize)) : 0, size: barSize, thumb: ACCENT, track: MUTED }
        : undefined

    const rows: RowSpec[] = shown.map((id, offset) => {
      const index = from + offset
      const label = state.labels[id] ?? friendly(id)
      const cut = label.lastIndexOf(' · ')
      const name = cut < 0 ? label : label.slice(0, cut)
      const provider = cut < 0 ? '' : label.slice(cut + 3)
      const isCurrent = id === state.current
      // Every field is written or left out, never `undefined`: a `Client`'s
      // props are plain JSON, and one `undefined` refuses the whole tree.
      const left: Seg[] = [
        { t: `${String(index + 1).padStart(2, '0')}.`, c: NUMBER_COLOR },
        { t: ' ' },
        ...(isCurrent ? [{ t: name, c: ACCENT, b: true }] : [{ t: name }]),
        ...(provider === '' ? [] : [{ t: ` · ${provider}`, c: MUTED }]),
      ]
      return { id, left, right: isCurrent ? [{ t: ' ✓', c: TICK_COLOR }] : [] }
    })

    const props = {
      rows,
      active: anchor,
      activeBg: '#2A2F3A',
      hoverBg: '#232833',
      tones: {},
      ...(bar ? { bar } : {}),
    } satisfies RowsProps

    return (
      <Box flexDirection="column" minHeight={Math.max(1, body)}>
        {/* At the top, not the foot: a box past the pane's window is never drawn,
            so its keys would go dead. */}
        <Box key="hotkeys" height={0} overflow="hidden" flexDirection="row">
          {/* The arrows aim the ring at these two; `ui.focus` walks the caret and
              leaves the ring on Enter, so ↑↓ work from the moment the pane opens. */}
          <Button key="hk-nav-up" plain label="up" onPress={() => void moveCaret($, -1)} />
          <Button key="hk-enter" plain autoFocus label="return" onPress={() => void pickAnchor($)} />
          <Button key="hk-nav-down" plain label="down" onPress={() => void moveCaret($, 1)} />
          <Button key="hk-down" plain hotkey="j" label="j" onPress={() => void moveCaret($, 1)} />
          <Button key="hk-up" plain hotkey="k" label="k" onPress={() => void moveCaret($, -1)} />
          <Button key="hk-search" plain hotkey="s" label="s" onPress={() => $.clock.after(50, () => focusPane($, 'search'))} />
        </Box>

        <Text key="head" bold>
          {`Model · ${list.length} available`}
        </Text>

        <Box key="filter" flexDirection="row" borderStyle="round" borderColor={MUTED} paddingX={1} marginY={1}>
          <Text key="filter-mark" color={MUTED}>{'⌕ '}</Text>
          <Box key="filter-field" flexDirection="column" flexGrow={1} flexShrink={1}>
            <Box key="filter-up-box" height={0} overflow="hidden">
              <Button key="hk-filter-up" plain label="up" onPress={() => void moveCaret($, -1)} />
            </Box>
            <Input
              key="search"
              value={state.filter}
              placeholder="search"
              onInput={value => void search($, value)}
              onSubmit={() => void search($, '').then(() => focusPane($, 'hk-enter'))}
            />
            <Box key="filter-down-box" height={0} overflow="hidden">
              <Button key="hk-filter-down" plain label="down" onPress={() => void moveCaret($, 1)} />
            </Box>
          </Box>
        </Box>

        {list.length === 0 ? (
          <Text key="none" dimColor>{`  No model matches “${state.filter}”.`}</Text>
        ) : (
          <Client key="rows" module="./rows.tsx" props={props} />
        )}

        <Text key="effort-head" bold>
          {'Effort · this session, as /effort does'}
        </Text>
        {/* One row of six, never wrapped: the list's height is counted from
            this row, and a block that changed height would shift the window. */}
        <Box key="efforts" flexDirection="row" height={1} overflow="hidden" columnGap={1}>
          {EFFORTS.map(level => {
            const isOn = state.effort === level || (level === 'auto' && state.effort === null)
            return (
              <Button
                key={`effort-${level}`}
                label={isOn ? `${level} ✓` : level}
                variant={isOn ? 'primary' : undefined}
                onPress={() => void pickEffort($, level)}
              />
            )
          })}
        </Box>

        <Text key="hint" dimColor wrap="truncate-end">
          {'Click a row to mark it · ↑↓ or j/k walk · Enter or a quick second click switches · s searches · Esc closes'}
        </Text>
      </Box>
    )
  })
}

/** Walks the caret on a key from the list, as the file tree's `steer` does. */
async function walk($: EngineInterface, key: string, list: string[]): Promise<void> {
  if (key === 'return' || key === 'enter' || key === 'o') return pickAnchor($)
  if (key === 'down' || key === 'j') return moveCaret($, 1)
  if (key === 'up' || key === 'k') return moveCaret($, -1)
  if (key === 'pagedown' || key === 'f') return moveCaret($, Math.max(1, win.room - 1))
  if (key === 'pageup' || key === 'b') return moveCaret($, -Math.max(1, win.room - 1))
  if (key === 'home' || key === 'end') {
    const target = key === 'home' ? list[0] : list.at(-1)
    await update($, view, v => ({ ...v, cursor: target ?? v.cursor, scroll: null }))
    return
  }
  if (key === 's') return focusPane($, 'search')
}

/** Switches to the caret's row, as Enter does. */
async function pickAnchor($: EngineInterface): Promise<void> {
  const state = await read($, view)
  const list = matches(state)
  const target = list.includes(state.cursor) ? state.cursor : list[0]
  if (target !== undefined) await pickModel($, target)
}

/** Takes the search text, keeping the caret inside the matches. */
async function search($: EngineInterface, value: string): Promise<void> {
  await update($, view, v => {
    const next = { ...v, filter: value, scroll: null }
    const list = matches(next)
    const cursor = list.includes(v.cursor) ? v.cursor : (list[0] ?? '')
    return { ...next, cursor }
  })
}