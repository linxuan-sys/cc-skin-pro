import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

import { guideText, markerDistance, windowLinesOf } from '../hooks/guide'

const SURFACES = ['terminal', 'desktop'] as const
const SESSION = 'session-1'
const FULLSCREEN = { columns: 160, rows: 50, isFullscreen: true }

const PANE = {
  plugin: 'transcript-bookmarks',
  component: 'Pane',
  requestId: 'bookmarks',
  props: {
    title: 'Bookmarks',
    isFocused: false,
    bodyColumns: 48,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 40 },
    view: {},
  },
} as const

const saved = [
  { id: 'a', requestId: 'msg-a', kind: 'assistant', title: 'claude', excerpt: 'First answer\nwith two lines', createdAt: 0 },
  { id: 'b', requestId: 'msg-b', kind: 'user', title: 'you', excerpt: 'Second prompt', createdAt: 0 },
]

// The engine beneath the plugin: this session's id (a test moves it, as a
// /clear or /resume does), its saved bookmarks, and a record of the toasts,
// panes and copies the plugin asks for.
function world(on: On, entries: Record<string, unknown> = {}) {
  const store = new Map<string, unknown>(Object.entries(entries))
  const clock = mock.clock(on, { now: 1_700_000_000_000 })
  const seen = { session: SESSION, store, clock, toasts: [] as string[], opened: [] as string[], copied: [] as string[] }
  on('store.get', ($, e) => ({ value: store.get(e.key) }))
  on('store.set', ($, e) => {
    store.set(e.key, e.value)
    return { value: undefined }
  })
  on('store.delete', ($, e) => {
    store.delete(e.key)
    return { value: undefined }
  })
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  // The engine's own drawing of a message, which the plugin wraps.
  on('ui.render', { component: 'AssistantMessage' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>{e.props.text}</Text>
  })
  on('session.id', () => ({ value: seen.session }))
  on('session.end', ($, e) => ({ sessionId: e.sessionId }))
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('ui.toast', ($, e) => {
    seen.toasts.push(e.text)
    return { value: undefined }
  })
  on('ui.open', ($, e) => {
    seen.opened.push(e.id)
    return { value: { isPlaced: true } }
  })
  on('ui.copy', ($, e) => {
    seen.copied.push(e.text)
    return { value: { isCopied: true } }
  })
  return seen
}

const start = ($: Engine) =>
  $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })

const stored = (seen: ReturnType<typeof world>) =>
  seen.store.get(`bookmarks:${SESSION}`) as { id: string; excerpt: string }[] | undefined

test('restores the saved bookmarks and Delete removes one', async ($, on) => {
  const seen = world(on, { [`bookmarks:${SESSION}`]: saved })
  await start($)
  expect(seen.opened).toContain('bookmarks')

  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await ui.find({ text: /First answer/ })).toBeDefined()
    expect(await ui.find({ text: /Second prompt/ })).toBeDefined()
    await ui.unmount()
  }

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'del:a' })
  expect(await ui.find({ text: /First answer/ })).toBeUndefined()
  expect(await ui.find({ text: /Second prompt/ })).toBeDefined()
  expect(stored(seen)?.map(b => b.id)).toEqual(['b'])

  await ui.press({ key: 'clear-all' })
  expect(await ui.find({ key: 'del:b' })).toBeUndefined()
  expect(stored(seen)).toBeUndefined()
})

test('the hover mark bookmarks a message once', async ($, on) => {
  const seen = world(on)
  await start($)

  for (const surface of SURFACES) {
    const row = await $.ui.mount({
      plugin: 'transcript-bookmarks',
      surface,
      component: 'AssistantMessage',
      requestId: `msg-${surface}`,
      props: { text: `Answer drawn on ${surface}`, isFirstOfReply: true },
      viewport: FULLSCREEN,
    })
    expect((await row.find({ key: `mark:msg-${surface}` }))?.text).toBe('📌')
    await row.press({ key: `mark:msg-${surface}` })
    expect((await row.find({ key: `mark:msg-${surface}` }))?.text).toBe('★')
    await row.press({ key: `mark:msg-${surface}` })
    expect(seen.toasts).toContain('That message is already bookmarked')
    await row.unmount()
  }

  expect(seen.opened).toContain('bookmarks')
  const pane = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await pane.find({ text: /Answer drawn on terminal/ })).toBeDefined()
  expect(await pane.find({ text: /Answer drawn on desktop/ })).toBeDefined()
  expect(stored(seen)?.length).toBe(2)
})

test('no mark on the terminal main screen, where nothing hovers', async ($, on) => {
  world(on)
  await start($)
  const row = await $.ui.mount({
    plugin: 'transcript-bookmarks',
    surface: 'terminal',
    component: 'AssistantMessage',
    requestId: 'msg-main',
    props: { text: 'Plain', isFirstOfReply: true },
    viewport: { columns: 120, rows: 40, isFullscreen: false },
  })
  expect(await row.find({ key: 'mark:msg-main' })).toBeUndefined()
})

test('/bookmark saves the selected text under its label', async ($, on) => {
  world(on)
  on('ui.selection', () => ({ value: { text: 'the part that matters', requestId: 'msg-sel' } }))
  await start($)

  const ran = await $.command.run({
    command: 'bookmark',
    args: ' auth idea ',
    origin: { kind: 'composer' },
    presentation: { isFullscreen: true, columns: 160 },
  })
  expect(ran.text).toBeUndefined()

  const pane = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await pane.find({ text: /auth idea · selection/ })).toBeDefined()
  expect(await pane.find({ text: /the part that matters/ })).toBeDefined()
})

test('a selection in a drawn message takes that message\'s title', async ($, on) => {
  world(on)
  on('ui.selection', () => ({ value: { text: 'one line of it', requestId: 'tool-1' } }))
  on('ui.render', { component: 'ToolUse' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>{e.props.tool}</Text>
  })
  await start($)

  await $.ui.mount({
    plugin: 'transcript-bookmarks',
    surface: 'terminal',
    component: 'ToolUse',
    requestId: 'tool-1',
    props: {
      tool_use_id: 'tool-1',
      tool: 'Edit',
      input: { file_path: '/repo/src/api/cache.ts' },
      isRunning: false,
      isErrored: false,
      isInterrupted: false,
    },
    viewport: FULLSCREEN,
  })
  await $.command.run({
    command: 'bookmark',
    args: '',
    origin: { kind: 'composer' },
    presentation: { isFullscreen: true, columns: 160 },
  })

  const pane = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await pane.find({ text: /Edit\(api\/cache\.ts\) · selection/ })).toBeDefined()
  expect(await pane.find({ text: /one line of it/ })).toBeDefined()
})

test('/bookmark with nothing selected says what to do', async ($, on) => {
  const seen = world(on)
  on('ui.selection', () => ({ value: undefined }))
  await start($)

  const ran = await $.command.run({
    command: 'bookmark',
    args: '',
    origin: { kind: 'composer' },
    presentation: { isFullscreen: true, columns: 160 },
  })
  expect(ran.text).toMatch(/Nothing is selected/)
  expect(stored(seen)).toBeUndefined()
})

test('Go to that cannot scroll copies the text and says why', async ($, on) => {
  // Nothing beneath a test scrolls a transcript row, so every jump here is
  // refused; the real scroll is the session's.
  const seen = world(on, { [`bookmarks:${SESSION}`]: saved })
  await start($)
  const pane = await $.ui.mount({ ...PANE, surface: 'terminal' })

  await pane.press({ key: 'jump:b' })
  expect(seen.copied).toEqual(['Second prompt'])
  expect(seen.toasts.some(t => t.startsWith("Can't scroll to that message"))).toBe(true)
})

test('a selection across several messages is kept, without a place to jump', async ($, on) => {
  const seen = world(on)
  on('ui.selection', () => ({ value: { text: 'spans two rows' } }))
  await start($)
  const pane = await $.ui.mount({ ...PANE, surface: 'terminal' })

  await pane.press({ key: 'add-selection' })
  expect(await pane.find({ text: /spans two rows/ })).toBeDefined()
  const id = stored(seen)?.[0]?.id
  await pane.press({ key: `jump:${id}` })
  expect(seen.copied).toEqual([])
  expect(seen.toasts.some(t => t.includes('no single place to jump to'))).toBe(true)
})

test('/bookmark outside fullscreen says it needs fullscreen', async ($, on) => {
  const seen = world(on)
  on('ui.selection', () => ({ value: { text: 'selected anyway', requestId: 'msg-sel' } }))
  await start($)

  const ran = await $.command.run({
    command: 'bookmark',
    args: 'a label',
    origin: { kind: 'composer' },
    presentation: { isFullscreen: false, columns: 120 },
  })
  expect(ran.text).toMatch(/needs the fullscreen terminal/)
  expect(stored(seen)).toBeUndefined()
})

test('/bookmarks opens the pane, on the main screen too', async ($, on) => {
  const seen = world(on)
  await start($)
  expect(seen.opened).toEqual([])

  const ran = await $.command.run({
    command: 'bookmarks',
    args: '',
    origin: { kind: 'composer' },
    presentation: { isFullscreen: false, columns: 120 },
  })
  expect(ran.text).toBeUndefined()
  expect(seen.opened).toEqual(['bookmarks'])
  const pane = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await pane.find({ text: /No bookmarks yet/ })).toBeDefined()
})

test('stops at 200 bookmarks until one is deleted', async ($, on) => {
  const full = Array.from({ length: 200 }, (_, i) => ({ ...saved[0], id: `b${i}`, requestId: `msg-${i}` }))
  const seen = world(on, { [`bookmarks:${SESSION}`]: full })
  on('ui.selection', () => ({ value: { text: 'one too many', requestId: 'msg-sel' } }))
  await start($)
  const bookmark = () =>
    $.command.run({
      command: 'bookmark',
      args: '',
      origin: { kind: 'composer' },
      presentation: { isFullscreen: true, columns: 160 },
    })

  await bookmark()
  expect(seen.toasts).toContain('You have 200 bookmarks already: delete some first')
  expect(stored(seen)?.length).toBe(200)
  expect(stored(seen)?.some(b => b.excerpt === 'one too many')).toBe(false)

  const pane = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await pane.press({ key: 'del:b0' })
  await bookmark()
  expect(stored(seen)?.length).toBe(200)
  expect(stored(seen)?.[0]?.excerpt).toBe('one too many')
})

test('keeps up to 2,000 characters of a bookmark\'s text', async ($, on) => {
  const seen = world(on)
  on('ui.selection', () => ({ value: { text: 'x'.repeat(2500), requestId: 'msg-sel' } }))
  await start($)

  await $.command.run({
    command: 'bookmark',
    args: '',
    origin: { kind: 'composer' },
    presentation: { isFullscreen: true, columns: 160 },
  })
  const excerpt = stored(seen)?.[0]?.excerpt
  expect(excerpt?.length).toBe(2000)
  expect(excerpt?.endsWith('x…')).toBe(true)
})

test('keeps the 50 most recent sessions with bookmarks', async ($, on) => {
  const older = Array.from({ length: 50 }, (_, i) => `old-${i}`)
  const seen = world(on, {
    'bookmarks-index': older,
    ...Object.fromEntries(older.map(id => [`bookmarks:${id}`, saved])),
  })
  on('ui.selection', () => ({ value: { text: 'new here', requestId: 'msg-sel' } }))
  await start($)
  const bookmark = () =>
    $.command.run({
      command: 'bookmark',
      args: '',
      origin: { kind: 'composer' },
      presentation: { isFullscreen: true, columns: 160 },
    })

  await bookmark()
  expect(seen.store.get('bookmarks-index')).toEqual([...older.slice(1), SESSION])
  expect(seen.store.has('bookmarks:old-0')).toBe(false)
  expect(seen.store.has('bookmarks:old-1')).toBe(true)

  // Saving this session again moves it to the end, and drops no one else.
  await bookmark()
  expect(seen.store.get('bookmarks-index')).toEqual([...older.slice(1), SESSION])
  expect(seen.store.has('bookmarks:old-1')).toBe(true)
  expect(stored(seen)?.length).toBe(2)
})

test('/clear empties the list and the old session keeps its bookmarks', async ($, on) => {
  const seen = world(on, { [`bookmarks:${SESSION}`]: saved })
  on('ui.selection', () => ({ value: { text: 'after the clear', requestId: 'msg-new' } }))
  await start($)
  const row = await $.ui.mount({
    plugin: 'transcript-bookmarks',
    surface: 'terminal',
    component: 'AssistantMessage',
    requestId: 'msg-a',
    props: { text: 'First answer', isFirstOfReply: true },
    viewport: FULLSCREEN,
  })
  expect((await row.find({ key: 'mark:msg-a' }))?.text).toBe('★')

  seen.session = 'session-2'
  await $.session.end({ reason: 'clear', sessionId: SESSION, resume: { id: SESSION } })
  expect((await row.find({ key: 'mark:msg-a' }))?.text).toBe('📌')
  const pane = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await pane.find({ text: /No bookmarks yet/ })).toBeDefined()

  await $.command.run({
    command: 'bookmark',
    args: '',
    origin: { kind: 'composer' },
    presentation: { isFullscreen: true, columns: 160 },
  })
  expect((seen.store.get('bookmarks:session-2') as unknown[] | undefined)?.length).toBe(1)
  expect(stored(seen)?.map(b => b.id)).toEqual(['a', 'b'])
})

// A reply taller than the window, drawn in the fullscreen terminal with the
// window `first` lines down it.
const tallRow = (onScreen: { first: number; last: number; of: number } | null) =>
  ({
    plugin: 'transcript-bookmarks',
    surface: 'terminal',
    component: 'AssistantMessage',
    requestId: 'msg-tall',
    props: { text: 'A long answer', isFirstOfReply: true, onScreen },
    viewport: FULLSCREEN,
  }) as const

const bookmarkSelection = ($: Engine) =>
  $.command.run({
    command: 'bookmark',
    args: '',
    origin: { kind: 'composer' },
    presentation: { isFullscreen: true, columns: 160 },
  })

type Saved = { id: string; excerpt: string; view?: { first: number; of: number } }
const savedList = (seen: ReturnType<typeof world>) => stored(seen) as Saved[] | undefined

const deep = {
  id: 'd',
  requestId: 'msg-tall',
  view: { first: 40, of: 200 },
  kind: 'selection',
  title: 'claude',
  excerpt: 'the deep part',
  createdAt: 0,
}

test('a selection deep in a tall row keeps where the window stood', async ($, on) => {
  const seen = world(on)
  on('ui.selection', () => ({ value: { text: 'the deep part', requestId: 'msg-tall' } }))
  await start($)

  const row = await $.ui.mount(tallRow({ first: 40, last: 79, of: 200 }))
  await bookmarkSelection($)
  expect(savedList(seen)?.[0]?.view).toEqual({ first: 40, of: 200 })

  // Scrolled out of the window, the row keeps the place it was last seen at.
  await row.redraw({ text: 'A long answer', isFirstOfReply: true, onScreen: null })
  await bookmarkSelection($)
  expect(savedList(seen)?.[0]?.view).toEqual({ first: 40, of: 200 })
})

test('a selection in a row whose top was on screen keeps no place', async ($, on) => {
  const seen = world(on)
  on('ui.selection', () => ({ value: { text: 'near the top', requestId: 'msg-tall' } }))
  await start($)

  await $.ui.mount(tallRow({ first: 0, last: 39, of: 200 }))
  await bookmarkSelection($)
  expect(savedList(seen)?.[0]?.excerpt).toBe('near the top')
  expect(savedList(seen)?.[0]?.view).toBeUndefined()
})

test('the count to the ▶ follows the window, line by line, down to 0', () => {
  // The marker is on line 40 of a 200-line row; the window is 40 lines high.
  const at = (first: number, last: number) => markerDistance(40, { first, last, of: 200 }, 40)

  expect(windowLinesOf({ first: 120, last: 159, of: 200 })).toBe(40)
  expect(windowLinesOf({ first: 0, last: 39, of: 200 })).toBeUndefined()

  expect(at(0, 39)).toBe(40) // Go to landed: the row's top is the window's top
  expect(at(25, 64)).toBe(15)
  expect(at(41, 80)).toBe(-1)
  expect(at(40, 79)).toBe(0)
  // Scrolled up past the row's top: it starts on the window's 11th line.
  expect(at(0, 29)).toBe(50)
  // A row that fits the window shows its marker.
  expect(markerDistance(12, { first: 0, last: 29, of: 30 }, 40)).toBe('shown')

  expect(guideText(15)).toEqual({ text: '▶ is 15 lines below the top of the window: scroll down', isThere: false })
  expect(guideText(-1)).toEqual({ text: '▶ is 1 line above the top of the window: scroll up', isThere: false })
  expect(guideText(0)).toEqual({
    text: '▶ is at the top of the window: this is where you selected the text',
    isThere: true,
  })
  expect(guideText('shown').isThere).toBe(true)
})

test('a row with a marker draws ▶ in its left margin, on that line', async ($, on) => {
  world(on)
  on('state.get', async ($, e, next) => {
    const ref = e as { key: string; id?: string }
    const got = (await next(e)) as { value: { value: unknown; version: number } }
    return ref.key === 'markerLine' && ref.id === 'msg-tall' ? { value: { ...got.value, value: 40 } } : got
  })
  await start($)

  for (const surface of SURFACES) {
    const row = await $.ui.mount({ ...tallRow({ first: 0, last: 39, of: 200 }), surface })
    const drawn = JSON.stringify(await row.drawn())
    // Line numbers are the terminal's: other surfaces draw no marker.
    expect(drawn.includes('▶')).toBe(surface === 'terminal')
    if (surface === 'terminal') expect(drawn).toContain('"top":40')
    await row.unmount()
  }
})

// The writes to the per-row highlight, as `[row, highlighted text or null]`.
function highlightWrites(on: On) {
  const writes: [string | undefined, unknown][] = []
  on('state.set', ($, e, next) => {
    const write = e as { key: string; id?: string; value: unknown }
    if (write.key === 'markerLine' || write.key === 'highlight') {
      const value = write.value as { text?: string } | number | null
      writes.push([write.id, typeof value === 'object' && value !== null ? value.text : value])
    }
    return next(e)
  })
  return writes
}

test('Go to that cannot scroll takes the ▶ and the highlight off again', async ($, on) => {
  const seen = world(on, { [`bookmarks:${SESSION}`]: [deep, saved[1]] })
  const writes = highlightWrites(on)
  await start($)
  // The terminal is wider now, so the row wraps to half its lines.
  await $.ui.mount(tallRow({ first: 0, last: 49, of: 100 }))
  const pane = await $.ui.mount({ ...PANE, surface: 'terminal' })

  await pane.press({ key: 'jump:d' })
  expect(writes).toEqual([
    ['msg-tall', 20],
    ['msg-tall', 'the deep part'],
    ['msg-tall', 0],
    ['msg-tall', null],
  ])
  expect(seen.copied).toEqual(['the deep part'])
  expect(seen.toasts.some(t => t.startsWith('▶'))).toBe(false)

  // A whole message's bookmark marks and colors nothing.
  writes.length = 0
  await pane.press({ key: 'jump:b' })
  expect(writes).toEqual([['msg-b', 0], ['msg-b', null]])
})

test('the reply Go to jumped to shows the selected words in the code color', async ($, on) => {
  world(on)
  on('state.get', async ($, e, next) => {
    const ref = e as { key: string; id?: string }
    const got = (await next(e)) as { value: { value: unknown; version: number } }
    const mark = { text: 'the deep part', near: 0 }
    return ref.key === 'highlight' && ref.id === 'msg-tall' ? { value: { ...got.value, value: mark } } : got
  })
  await start($)

  const row = await $.ui.mount({
    ...tallRow({ first: 0, last: 39, of: 200 }),
    props: { text: 'Intro\nthe deep part, here\nOutro', isFirstOfReply: true, onScreen: { first: 0, last: 39, of: 200 } },
  })
  expect(await row.find({ text: 'Intro\n`the` `deep` `part`, here\nOutro' })).toBeDefined()
})

// The ▶ on line 40 of 'msg-tall' and its color, as a Go to to bookmark 'd' left them, until the mod writes.
function markedByGoTo(on: On) {
  let isSeeded = true
  const seeded: Record<string, unknown> = {
    markerRow: 'msg-tall',
    'markerLine:msg-tall': 40,
    'highlight:msg-tall': { id: 'd', text: 'the deep part', near: 0 },
  }
  on('state.get', async ($, e, next) => {
    const ref = e as { key: string; id?: string }
    const got = (await next(e)) as { value: { value: unknown; version: number } }
    const key = ref.id === undefined ? ref.key : `${ref.key}:${ref.id}`
    return isSeeded && key in seeded ? { value: { ...got.value, value: seeded[key] } } : got
  })
  const writes = highlightWrites(on)
  return { writes, stopSeeding: () => (isSeeded = false) }
}

for (const action of ['delete', 'clear all'] as const) {
  test(`${action === 'delete' ? 'Delete on that bookmark' : 'Clear all'} takes the ▶ and the color off`, async ($, on) => {
    world(on, { [`bookmarks:${SESSION}`]: [deep, saved[1]] })
    const { writes, stopSeeding } = markedByGoTo(on)
    await start($)
    const pane = await $.ui.mount({ ...PANE, surface: 'terminal' })

    // Another bookmark's Delete leaves them.
    await pane.press({ key: 'del:b' })
    expect(writes).toEqual([])

    await pane.press({ key: action === 'delete' ? 'del:d' : 'clear-all' })
    stopSeeding()
    expect(writes).toEqual([['msg-tall', 0], ['msg-tall', null]])
  })
}

test('/resume swaps in the resumed session\'s bookmarks', async ($, on) => {
  const seen = world(on, {
    [`bookmarks:${SESSION}`]: saved,
    'bookmarks:session-0': [{ ...saved[0], id: 'z', excerpt: 'From the earlier session' }],
  })
  await start($)

  await $.session.end({ reason: 'resume', sessionId: SESSION, resume: { id: SESSION } })
  const before = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await before.find({ text: /No bookmarks yet/ })).toBeDefined()
  await before.unmount()

  // The process moves to the resumed session's id a moment later; the list follows by itself.
  seen.session = 'session-0'
  await seen.clock.advance(250)

  const pane = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await pane.find({ text: /From the earlier session/ })).toBeDefined()
  expect(await pane.find({ text: /First answer/ })).toBeUndefined()
  expect(stored(seen)?.map(b => b.id)).toEqual(['a', 'b'])
})
