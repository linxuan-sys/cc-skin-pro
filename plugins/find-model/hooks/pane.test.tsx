import { expect, mock, test } from 'claude-code/testing'

const PANE = {
  plugin: 'find-model',
  component: 'Pane',
  requestId: 'find-model',
  props: {
    title: 'Find model',
    isFocused: true,
    bodyColumns: 80,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 30 },
    view: {},
  },
} as const

const OPTIONS = Array.from({ length: 40 }, (_, i) => ({
  description: 'via magpie',
  label: `Model ${String(i + 1).padStart(2, '0')} · routing group`,
  model: `auto/model-${i + 1}[1m]`,
}))

const start = async ($, on, ran: { command: string; args?: string }[], session: { model: string }) => {
  const clock = mock.clock(on)
  // The pane is only shown once `ui.open` ran: were it shown from the start, the
  // command would read it as a second `/find-model` and close it.
  const shown = { now: false }

  on('settings.read', () => ({ value: { modelPicker: { options: OPTIONS } } }))
  on('command.register', () => ({ value: { command: 'find-model' } }))
  on('ui.open', () => {
    shown.now = true
    return { value: { isPlaced: true } }
  })
  on('ui.close', () => {
    shown.now = false
    return { value: undefined }
  })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('config.list', () => ({ value: [] }))
  on('session.model', () => ({ value: session.model }))
  on('ui.panes', () => ({ value: shown.now ? [{ id: 'find-model', isShown: true }] : [] }))
  on('command.run', (_, e) => {
    ran.push({ command: e.command, args: e.args })
    return { text: 'ok' }
  })

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.command.run({ command: 'find-model' })
  return clock
}

test('the list draws, and Enter switches the model the caret sits on', async ($, on) => {
  const ran: { command: string; args?: string }[] = []
  const session = { model: 'auto/model-1[1m]' }
  await start($, on, ran, session)

  let at = 1
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    await ui.resize({ columns: 80, rows: 20 })

    const texts = (await ui.findAll({ type: 'Text', in: 'rows' })).map(one => one.text)
    expect(texts).toContain(' ✓')
    expect(texts.some(one => one.startsWith('Model '))).toBe(true)

    await ui.press({ key: 'hk-nav-down' })
    at += 1
    await ui.press({ key: 'hk-enter' })
    expect(ran.at(-1)).toEqual({ command: 'model', args: `auto/model-${at}[1m]` })

    await ui.unmount()
  }
})

test('the search box filters the list', async ($, on) => {
  const ran: { command: string; args?: string }[] = []
  await start($, on, ran, { model: 'auto/model-1[1m]' })

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.resize({ columns: 80, rows: 20 })
  await ui.input({ key: 'search', text: 'Model 07', kind: 'change' })

  const texts = (await ui.findAll({ type: 'Text', in: 'rows' })).map(one => one.text)
  expect(texts).toContain('Model 07')
  expect(texts).not.toContain('Model 01')

  await ui.unmount()
})

test('Enter in the search box clears the filter back to the whole list', async ($, on) => {
  const ran: { command: string; args?: string }[] = []
  await start($, on, ran, { model: 'auto/model-1[1m]' })

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.resize({ columns: 80, rows: 20 })
  await ui.input({ key: 'search', text: 'Model 07', kind: 'change' })
  await ui.input({ key: 'search', text: '', kind: 'submit' })

  // Searching is done while typing; Enter hands back the whole list, and the
  // input's displayed value and the filter both read empty (no stray filter left).
  await ui.resize({ columns: 80, rows: 20 })
  const texts = (await ui.findAll({ type: 'Text', in: 'rows' })).map(one => one.text)
  expect(texts.some(one => one.startsWith('Model 01'))).toBe(true)
  expect(texts.some(one => one.startsWith('Model 07'))).toBe(true)

  await ui.unmount()
})

test('the effort row runs /effort, all six on one line', async ($, on) => {
  const ran: { command: string; args?: string }[] = []
  await start($, on, ran, { model: 'auto/model-1[1m]' })

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const row = await ui.find({ key: 'efforts' })
  expect(row).toBeDefined()
  expect((await ui.findAll({ type: 'Button' })).filter(one => /^(low|medium|high|xhigh|max|auto)/.test(one.text ?? ''))).toHaveLength(6)

  await ui.press({ key: 'effort-high' })
  expect(ran.at(-1)).toEqual({ command: 'effort', args: 'high' })

  await ui.unmount()
})

test('a /model run from the composer reaches the pane', async ($, on) => {
  const ran: { command: string; args?: string }[] = []
  const session = { model: 'auto/model-1[1m]' }
  const clock = await start($, on, ran, session)

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.resize({ columns: 80, rows: 20 })

  // The person runs /model from the prompt: the engine's model changes, and
  // nothing tells the pane; it asks on its own tick, and the tick moves.
  session.model = 'auto/model-5[1m]'
  await clock.advance(1600)
  await ui.resize({ columns: 80, rows: 20 })

  const texts = (await ui.findAll({ type: 'Text', in: 'rows' })).map(one => one.text)
  const index = texts.indexOf(' ✓')
  expect(index).toBeGreaterThan(0)
  expect(texts.slice(0, index).join('')).toContain('Model 05')

  await ui.unmount()
})
