import { atom, memberOf, read, update } from 'claude-code'
import type {
  ElementTable,
  EngineInterface,
  Register,
  RenderElement,
  RenderSurface,
  RenderViewport,
} from 'claude-code'

import type { Bookmark, BookmarkKind, Highlight, RowView } from '../types'
import { guideText, markerDistance, windowLinesOf } from './guide'
import type { OnScreen } from './guide'
import { highlightSelection } from './highlight'

const PANE = 'bookmarks'
const TITLE = 'Bookmarks'
const STORE_PREFIX = 'bookmarks:'
const STORE_INDEX = 'bookmarks-index'
const MAX_BOOKMARKS = 200
const MAX_SESSIONS = 50
const MAX_TEXT = 2000
const MAX_ROWS = 500
const PREVIEW_LINES = 3
const GUIDE_TOAST_MS = 6000
// After /clear or /resume: how often, and how many times, to look for the new session id.
const SESSION_POLL_MS = 250
const SESSION_POLL_TRIES = 40

const list = atom({ plugin: 'transcript-bookmarks', key: 'list' } as const, [])
const loadedFor = atom({ plugin: 'transcript-bookmarks', key: 'loadedFor' } as const, '')
const marked = atom({ plugin: 'transcript-bookmarks', key: 'marked' } as const, false)
const markerLine = atom({ plugin: 'transcript-bookmarks', key: 'markerLine' } as const, 0)
const highlight = atom({ plugin: 'transcript-bookmarks', key: 'highlight' } as const, null)
const markerRow = atom({ plugin: 'transcript-bookmarks', key: 'markerRow' } as const, '')

type MessageKind = Exclude<BookmarkKind, 'selection'>
type RowTitle = { kind: MessageKind; title: string }
type Row = RowTitle & { text: string }
type NewBookmark = Omit<Bookmark, 'id' | 'createdAt'>

// Who wrote each drawn transcript row, so a selection (which only names its
// row) can be titled, and where the terminal's window last stood in the row,
// so a selection deep in a tall row can be found again. Titles and line
// numbers only: a row's text is kept just when its 📌 is pressed. A cache: a
// reload redraws the rows and refills it.
const rows = new Map<string, RowTitle & { seen?: OnScreen }>()

function remember(requestId: string, { kind, title }: RowTitle, seen: OnScreen | undefined) {
  const before = rows.get(requestId)
  rows.delete(requestId)
  rows.set(requestId, { kind, title, seen: seen ?? before?.seen })
  if (rows.size > MAX_ROWS) {
    const oldest = rows.keys().next().value
    if (oldest !== undefined) rows.delete(oldest)
  }
}

// The transcript window's height in lines, read off a row taller than it.
let windowLines: number | undefined

// After Go to on a selection deep in a tall row: the row with the ▶ marker,
// the marker's line, and the last count shown, so each scroll that changes
// the count shows it again. `hasLanded` waits for the row's first report with
// its top at the window's top, so a report from before the jump counts for
// nothing. Ends at 0, or when the row leaves the screen.
type Guide = { requestId: string; line: number; text: string; hasLanded: boolean }
let guide: Guide | undefined

const clip = (text: string, max: number) =>
  text.length > max ? `${text.slice(0, max - 1)}…` : text

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const isRowView = (value: unknown): value is RowView =>
  isRecord(value) &&
  Number.isInteger(value.first) &&
  Number.isInteger(value.of) &&
  (value.first as number) > 0 &&
  (value.first as number) < (value.of as number)

function asBookmarks(value: unknown): Bookmark[] {
  if (!Array.isArray(value)) return []
  return value
    .filter(
      (b): b is Bookmark =>
        isRecord(b) &&
        typeof b.id === 'string' &&
        typeof b.title === 'string' &&
        typeof b.excerpt === 'string' &&
        typeof b.createdAt === 'number',
    )
    .map(({ view, ...rest }) => (isRowView(view) ? { ...rest, view } : rest))
}

const asStrings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((s): s is string => typeof s === 'string') : []

function toolTitle(tool: string, input: unknown): { title: string; text: string } {
  const args = isRecord(input) ? input : {}
  const arg = [args.file_path, args.notebook_path, args.command, args.pattern, args.url, args.description]
    .find((v): v is string => typeof v === 'string' && v.length > 0)
  if (arg === undefined) return { title: tool, text: tool }
  const short = arg === args.file_path || arg === args.notebook_path
    ? arg.split('/').slice(-2).join('/')
    : arg.split('\n')[0] ?? arg
  return { title: `${tool}(${clip(short, 40)})`, text: arg }
}

function clockTime(ms: number) {
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function previewLines(excerpt: string) {
  const lines = excerpt.split('\n').map(line => line.trimEnd()).filter(line => line.trim() !== '')
  const shown = lines.slice(0, PREVIEW_LINES)
  if (lines.length > PREVIEW_LINES) shown.push('…')
  return shown.length > 0 ? shown : ['(no text)']
}

// Hover marks need a pointer: the fullscreen terminal, or an app surface.
function showsMarks(surface: RenderSurface, viewport: RenderViewport | undefined) {
  if (surface === 'terminal') return viewport?.isFullscreen === true
  return surface !== 'mobile'
}

async function persist($: EngineInterface) {
  const id = await $.session.id()
  const items = await read($, list)
  const index = asStrings(await $.store.get(STORE_INDEX)).filter(s => s !== id)
  if (items.length === 0) {
    await $.store.delete(STORE_PREFIX + id)
  } else {
    await $.store.set(STORE_PREFIX + id, items)
    index.push(id)
  }
  for (const old of index.splice(0, Math.max(0, index.length - MAX_SESSIONS))) {
    await $.store.delete(STORE_PREFIX + old)
  }
  await $.store.set(STORE_INDEX, index)
}

async function syncMark($: EngineInterface, requestId: string | undefined) {
  if (requestId === undefined) return
  const items = await read($, list)
  const isMarked = items.some(b => b.requestId === requestId)
  await update($, memberOf(marked, { requestId }), () => isMarked)
}

async function replaceList($: EngineInterface, bookmarks: Bookmark[]) {
  const previous = await read($, list)
  await update($, list, () => bookmarks)
  const rows = new Set([...previous, ...bookmarks].map(b => b.requestId))
  for (const requestId of rows) await syncMark($, requestId)
}

// Loads this session's saved bookmarks once per session id: a hot reload
// keeps the list, a resumed session gets its own back.
async function ensureLoaded($: EngineInterface) {
  const id = await $.session.id()
  if ((await read($, loadedFor)) === id) return
  await replaceList($, asBookmarks(await $.store.get(STORE_PREFIX + id)))
  await update($, loadedFor, () => id)
}

function openPane($: EngineInterface) {
  return $.ui.open({ id: PANE, title: TITLE })
}

async function addBookmark($: EngineInterface, bookmark: NewBookmark) {
  await ensureLoaded($)
  if ((await read($, list)).length >= MAX_BOOKMARKS) {
    $.ui.toast(`You have ${MAX_BOOKMARKS} bookmarks already: delete some first`)
    return
  }
  const createdAt = await $.clock.now()
  const added: Bookmark = {
    ...bookmark,
    excerpt: clip(bookmark.excerpt, MAX_TEXT),
    id: `${createdAt.toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt,
  }
  await update($, list, items => [added, ...items])
  await syncMark($, added.requestId)
  await persist($)
  await openPane($)
  $.ui.toast(`Bookmarked: ${added.title}`)
}

async function removeBookmark($: EngineInterface, id: string) {
  const gone = (await read($, list)).find(b => b.id === id)
  await update($, list, items => items.filter(b => b.id !== id))
  await syncMark($, gone?.requestId)
  await persist($)
  // The ▶ and the color belong to the bookmark Go to last jumped to.
  const row = await read($, markerRow)
  if (row !== '' && (await read($, memberOf(highlight, { requestId: row })))?.id === id) await clearMarks($)
}

async function clearAll($: EngineInterface) {
  await replaceList($, [])
  await persist($)
  await clearMarks($)
}

async function markMessage($: EngineInterface, requestId: string, row: Row) {
  await ensureLoaded($)
  const already = (await read($, list)).find(b => b.requestId === requestId && b.kind !== 'selection')
  if (already !== undefined) {
    await openPane($)
    $.ui.toast('That message is already bookmarked')
    return
  }
  await addBookmark($, { requestId, kind: row.kind, title: row.title, excerpt: row.text })
}

// Answers with why nothing was bookmarked, or undefined once it was.
async function bookmarkSelection($: EngineInterface, label: string): Promise<string | undefined> {
  const selection = await $.ui.selection()
  if (selection === undefined || selection.text.trim() === '') {
    return 'Nothing is selected: select text in the transcript with the mouse first (fullscreen mode).'
  }
  const info = selection.requestId === undefined ? undefined : rows.get(selection.requestId)
  // The text was on screen when it was selected. In a row whose top was
  // scrolled away, keep where the window stood, so Go to can mark that line.
  const seen = info?.seen
  const view = seen !== undefined && seen.first > 0 ? { first: seen.first, of: seen.of } : undefined
  await addBookmark($, {
    requestId: selection.requestId,
    ...(view === undefined ? {} : { view }),
    kind: 'selection',
    title: label !== '' ? label : (info?.title ?? 'selection'),
    excerpt: selection.text,
  })
  if (selection.requestId === undefined) {
    $.ui.toast('Saved, but the selection spans several messages, so it has no single place to jump to')
  }
  return undefined
}

// Puts the ▶ marker on one line of one row and colors the selection there,
// and takes both off the row that had them; `line` 0 and `mark` null put
// neither. One row at a time.
async function markRow($: EngineInterface, requestId: string, line: number, mark: Highlight | null) {
  const before = await read($, markerRow)
  if (before !== '' && before !== requestId) {
    await update($, memberOf(markerLine, { requestId: before }), () => 0)
    await update($, memberOf(highlight, { requestId: before }), () => null)
  }
  await update($, memberOf(markerLine, { requestId }), () => line)
  await update($, memberOf(highlight, { requestId }), () => mark)
  await update($, markerRow, () => (line > 0 || mark !== null ? requestId : ''))
}

// Takes the ▶, the color and the count away, wherever they are.
async function clearMarks($: EngineInterface) {
  endGuide($)
  const row = await read($, markerRow)
  if (row !== '') await markRow($, row, 0, null)
}

// About where in its row a selection is, for telling repeated text apart.
function nearOf(bookmark: Bookmark): number {
  const view = bookmark.view
  if (view === undefined) return 0
  return Math.min(1, (view.first + (windowLines ?? 0) / 2) / view.of)
}

// The row's line that was at the window's top when the text was selected; 0
// when the row's top was on screen then.
function viewLine(bookmark: Bookmark): number {
  const view = bookmark.view
  if (view === undefined || bookmark.requestId === undefined) return 0
  // A narrower or wider terminal wraps the row again: scale to its height now.
  const of = rows.get(bookmark.requestId)?.seen?.of ?? view.of
  return Math.max(0, Math.min(Math.round((view.first * of) / view.of), of - 1))
}

// A toast can't change its text: each call stacks a new box. So the count
// lives in this plugin's status line under the prompt, which each call
// replaces; a toast says only where the count starts and that you arrived.
function showGuide($: EngineInterface, current: Guide, distance: number | 'shown') {
  const { text, isThere } = guideText(distance)
  if (text === current.text) return
  const isFirst = current.text === ''
  current.text = text
  if (isThere) {
    endGuide($)
    $.ui.toast(text, { timeoutMs: GUIDE_TOAST_MS })
    return
  }
  $.ui.status(text)
  if (isFirst) $.ui.toast(`${text}. The count under the prompt follows your scrolling.`, { timeoutMs: GUIDE_TOAST_MS })
}

function endGuide($: EngineInterface) {
  if (guide === undefined) return
  guide = undefined
  $.ui.status(undefined)
}

// Each scroll the terminal reports for the guided row updates the count.
function followGuide($: EngineInterface, requestId: string, onScreen: OnScreen | null | undefined) {
  const current = guide
  if (current?.requestId !== requestId || onScreen === undefined) return
  if (onScreen === null) {
    if (current.hasLanded) endGuide($)
    return
  }
  if (!current.hasLanded) {
    if (onScreen.first !== 0) return
    current.hasLanded = true
  }
  showGuide($, current, markerDistance(current.line, onScreen, windowLines))
}

// A row taller than the window shows the window's height.
function learnWindow(onScreen: OnScreen | null | undefined) {
  const height = onScreen ? windowLinesOf(onScreen) : undefined
  if (height !== undefined) windowLines = height
}

// The engine scrolls a row into view by its top only. For a selection deep
// in a tall row, a ▶ marks the line that was at the window's top when the
// text was selected, and the status line counts the lines to it as you scroll.
async function jump($: EngineInterface, bookmark: Bookmark, surface: RenderSurface) {
  const requestId = bookmark.requestId
  if (requestId === undefined) {
    $.ui.toast('This bookmark spans several messages, so there is no single place to jump to')
    return
  }
  const line = viewLine(bookmark)
  const mark = bookmark.kind === 'selection'
    ? { id: bookmark.id, text: bookmark.excerpt, near: nearOf(bookmark) }
    : null
  endGuide($)
  await markRow($, requestId, line, mark)
  const why = await $.ui.scroll({ to: { requestId }, block: 'start' }).then(
    scrolled => scrolled.deny,
    (error: unknown) => String(error instanceof Error ? error.message : error),
  )
  if (why === undefined) {
    if (line === 0) return
    // The row's top is at the window's top now.
    const started: Guide = { requestId, line, text: '', hasLanded: false }
    guide = started
    showGuide($, started, line)
    return
  }
  if (line > 0 || mark !== null) await markRow($, requestId, 0, null)
  const copied = await $.ui.copy({ text: bookmark.excerpt, surface })
  $.ui.toast(
    `Can't scroll to that message (${why}).` +
      (copied.isCopied ? ' Its text is on the clipboard.' : ''),
  )
}

// The engine's own drawing of a row, with a 📌 always at its top right, and ★
// once the row is bookmarked. The 📌 carries the row's text, so nothing else
// needs to remember it. With `marker`, a ▶ sits in the left margin of that
// line, over the row's indent, so no text moves.
function markable(
  $: EngineInterface,
  ui: Pick<ElementTable, 'Box' | 'Button' | 'Text'>,
  requestId: string,
  drawing: RenderElement,
  row: Row,
  isMarked: boolean,
  marker: number,
) {
  const { Box, Button, Text } = ui
  return (
    <Box key={`bm:${requestId}`} flexDirection="column">
      {drawing}
      {marker > 0 && (
        <Box position="absolute" top={marker} left={0}>
          <Text color="warning" bold>
            ▶
          </Text>
        </Box>
      )}
      <Box position="absolute" top={0} right={1}>
        <Button
          plain
          dimColor
          key={`mark:${requestId}`}
          label={isMarked ? '★' : '📌'}
          onPress={() => markMessage($, requestId, row)}
        />
      </Box>
    </Box>
  )
}

type RowSite = {
  requestId: string
  surface: RenderSurface
  viewport?: RenderViewport
  props: { onScreen?: OnScreen | null }
}

// What every transcript row hook draws: the row's title and place are noted,
// and where the pointer can hover, the row gets its 📌 (and its ▶ marker).
// Line numbers are the terminal's, so places and markers are kept for it only.
async function drawRow(
  $: EngineInterface,
  e: RowSite,
  ui: Pick<ElementTable, 'Box' | 'Button' | 'Text'>,
  drawing: RenderElement,
  row: Row,
) {
  const isTerminal = e.surface === 'terminal'
  const onScreen = isTerminal ? e.props.onScreen : undefined
  remember(e.requestId, row, onScreen ?? undefined)
  learnWindow(onScreen)
  followGuide($, e.requestId, onScreen)
  if (!showsMarks(e.surface, e.viewport)) return drawing

  const marker = isTerminal ? await read($, memberOf(markerLine, e)) : 0
  return markable($, ui, e.requestId, drawing, row, await read($, memberOf(marked, e)), marker)
}

// No session.start fires after a /clear or a /resume: wait until the process
// runs under the new session id, then load that session's bookmarks.
function loadNextSession($: EngineInterface, endedId: string) {
  let tries = 0
  const timer = $.clock.every(SESSION_POLL_MS, () => {
    tries += 1
    void $.session.id().then(
      async id => {
        if (id === endedId && tries < SESSION_POLL_TRIES) return
        timer.cancel()
        await ensureLoaded($)
        if ((await read($, list)).length > 0) await openPane($)
      },
      () => timer.cancel(),
    )
  })
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'bookmarks',
      description: 'Open the bookmarks pane',
      immediate: true,
    })
    await $.command.register({
      name: 'bookmark',
      description: 'Bookmark the text you selected with the mouse',
      argumentHint: '[label]',
      immediate: true,
    })
    await ensureLoaded($)
    if ((await read($, list)).length > 0) void openPane($)

    return next(e)
  })

  // A /clear or /resume moves the process to another session id: its rows are
  // gone, so the list is too (the old session's stay saved for its resume).
  on('session.end', async ($, e, next) => {
    if (e.reason === 'clear' || e.reason === 'resume') {
      await replaceList($, [])
      await clearMarks($)
      await update($, loadedFor, () => '')
      loadNextSession($, e.sessionId)
    }

    return next(e)
  })

  on('command.run', { command: 'bookmarks' }, async $ => {
    await ensureLoaded($)
    await openPane($)

    return {}
  })

  on('command.run', { command: 'bookmark' }, async ($, e) => {
    if (!e.presentation.isFullscreen) {
      return { text: 'Bookmarking a selection needs the fullscreen terminal (CLAUDE_CODE_NO_FLICKER=1, outside tmux).' }
    }
    const refusal = await bookmarkSelection($, e.args.trim())

    return refusal === undefined ? {} : { text: refusal }
  })

  // The reply Go to jumped to for a selection shows the selected words in
  // Claude Code's code color: its displayed text alone is rewritten.
  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
    const mark = await read($, memberOf(highlight, e))
    const shown = mark === null ? e.props.text : highlightSelection(e.props.text, mark.text, mark.near)
    const drawing = await next(shown === e.props.text ? e : { ...e, props: { ...e.props, text: shown } })
    const row: Row = { kind: 'assistant', title: 'claude', text: e.props.text }

    return drawRow($, e, $.ui.resolve(e), drawing, row)
  })

  on('ui.render', { component: 'UserMessage' }, async ($, e, next) => {
    const drawing = await next(e)
    const title = e.props.from?.name ?? (e.props.origin.kind === 'task-notification' ? 'task' : 'you')
    const row: Row = { kind: 'user', title, text: e.props.text }

    return drawRow($, e, $.ui.resolve(e), drawing, row)
  })

  on('ui.render', { component: 'ToolUse' }, async ($, e, next) => {
    const drawing = await next(e)
    const row: Row = { kind: 'tool', ...toolTitle(e.props.tool, e.props.input) }

    return drawRow($, e, $.ui.resolve(e), drawing, row)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Button, Text } = $.ui.resolve(e)
    const items = await read($, list)
    // Borrow skins' reply renderer for the saved text; fall back to plain lines.
    const columns = Math.max(20, (e.props.bodyColumns ?? 60) - 2)
    const rows = await Promise.all(
      items.map(async bookmark => {
        let drawn: RenderElement | undefined
        try {
          drawn = await ($ as unknown as {
            skins: {
              markdown: (args: { surface: RenderSurface; text: string; columns: number }) => Promise<RenderElement | undefined>
            }
          }).skins.markdown({ surface: e.surface, text: bookmark.excerpt, columns })
        } catch {
          drawn = undefined
        }
        return { bookmark, drawn }
      }),
    )

    return (
      <Box flexDirection="column" width={Math.max(10, e.props.bodyColumns)}>
        <Box flexDirection="row" gap={1}>
          <Button
            key="add-selection"
            variant="primary"
            label="+ Bookmark selection"
            onPress={async () => {
              const refusal = await bookmarkSelection($, '')
              if (refusal !== undefined) $.ui.toast(refusal)
            }}
          />
          {items.length > 0 && (
            <Button key="clear-all" label="Clear all" onPress={() => clearAll($)} />
          )}
        </Box>
        {items.length === 0 && (
          <Box marginTop={1}>
            <Text dimColor>
              No bookmarks yet. Hover a message and click 📌, or select text with the mouse and
              press "+ Bookmark selection" (or type /bookmark).
            </Text>
          </Box>
        )}
        {rows.map(({ bookmark, drawn }) => (
          <Box key={`b:${bookmark.id}`} flexDirection="column" marginTop={1}>
            <Text dimColor wrap="truncate-end">
              {bookmark.title}
              {bookmark.kind === 'selection' ? ' · selection' : ''} · {clockTime(bookmark.createdAt)}
            </Text>
            {drawn ?? previewLines(bookmark.excerpt).map(line => (
              <Text wrap="truncate-end">{line}</Text>
            ))}
            <Box flexDirection="row" gap={1}>
              <Button
                key={`jump:${bookmark.id}`}
                label="Go to"
                dimColor={bookmark.requestId === undefined}
                onPress={press => jump($, bookmark, press.surface)}
              />
              <Button
                key={`del:${bookmark.id}`}
                label="Delete"
                onPress={() => removeBookmark($, bookmark.id)}
              />
            </Box>
          </Box>
        ))}
      </Box>
    )
  })
}
