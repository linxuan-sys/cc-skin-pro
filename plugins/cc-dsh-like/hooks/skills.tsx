/**
 * Skills banner under the wordmark. Click opens a dropdown; enter sends the pick.
 *
 * `<Button>` inside a `Placed` row does not press, so this draws its own
 * list and handles mouse and keyboard itself.
 */
import type { ClientModule } from 'claude-code'

export type SkillsProps = {
  skills: readonly string[]
  width: number
}

type SkillsState = {
  open: boolean
  query: string
  selected: number
  scroll: number
}

const MAX_ROWS = 10

const HEADER_ROW = 0
const SEARCH_ROW = 1
const LIST_START = 2

const ORANGE = '#e68a69'
const ORANGE_LIGHT = '#efa97e'
const ORANGE_PALE = '#fbd6b0'

const COLLAPSED: SkillsState = { open: false, query: '', selected: 0, scroll: 0 }

const filter = (skills: readonly string[], query: string): readonly string[] => {
  const needle = query.trim().toLowerCase()
  if (needle === '') return skills
  return skills.filter(name => name.toLowerCase().includes(needle))
}

const clamp = (value: number, max: number): number => Math.max(0, Math.min(max, value))

/** `onPointer`/`onKey` are attached once and capture stale props, so refresh this every redraw. */
let latest: SkillsProps = { skills: [], width: 0 }

const Skills: ClientModule<SkillsProps, SkillsState> = (props, surface) => {
  latest = props
  const { Box, Text } = surface.elements

  if (surface.state === undefined) {
    surface.onPointer(event => {
      if (event.type !== 'down') return
      if (event.button !== undefined && event.button !== 'left') return
      const state = surface.state
      if (state === undefined) return

      if (event.y === HEADER_ROW) {
        surface.setState({ ...state, open: !state.open, selected: 0, scroll: 0 })
        return
      }
      if (!state.open || event.y === SEARCH_ROW) return

      const index = state.scroll + event.y - LIST_START
      const name = filter(latest.skills, state.query)[index]
      if (name === undefined) return

      // Second click on the same row confirms, to avoid mis-taps.
      if (state.selected === index) {
        surface.post({ pick: name })
        surface.setState(COLLAPSED)
        return
      }
      surface.setState({ ...state, selected: index })
    })

    surface.onKey(event => {
      const state = surface.state
      if (state === undefined) return
      const list = filter(latest.skills, state.query)

      if (event.key === 'return') {
        const name = list[state.selected]
        if (name !== undefined) {
          surface.post({ pick: name })
          surface.setState(COLLAPSED)
        }
        return
      }

      if (event.key === 'up' || event.key === 'down') {
        if (!state.open) return
        const moved = clamp(state.selected + (event.key === 'down' ? 1 : -1), list.length - 1)
        const scroll =
          moved < state.scroll
            ? moved
            : moved >= state.scroll + MAX_ROWS
              ? moved - MAX_ROWS + 1
              : state.scroll
        surface.setState({ ...state, selected: moved, scroll })
        return
      }

      if (event.key === 'backspace') {
        if (state.query === '') return
        surface.setState({ ...state, query: state.query.slice(0, -1), selected: 0, scroll: 0 })
        return
      }

      if (event.ctrl === true || event.meta === true || event.alt === true) return
      if (event.key.length !== 1) return
      surface.setState({ ...state, open: true, query: state.query + event.key, selected: 0, scroll: 0 })
    })

    surface.setState(COLLAPSED)
  }

  const state = surface.state ?? COLLAPSED
  const list = filter(latest.skills, state.query)
  const rows = []

  rows.push(
    Box({
      key: 'header',
      flexDirection: 'row',
      children: [
        Text({ key: 'caret', color: ORANGE, children: state.open ? '▾ ' : '▸ ' }),
        Text({ key: 'label', color: ORANGE, children: `Skills  ${latest.skills.length}` }),
        Text({
          key: 'hint',
          dimColor: true,
          children: state.open
            ? '   up/down pick · enter send · type to search'
            : '   Click me to open',
        }),
      ],
    }),
  )

  if (state.open) {
    rows.push(
      Text({
        key: 'search',
        color: ORANGE_LIGHT,
        children: state.query === '' ? '> ' : `> ${state.query}`,
      }),
    )

    if (list.length === 0) {
      rows.push(Text({ key: 'empty', dimColor: true, children: '  no matching skill' }))
    }

    const last = Math.min(list.length, state.scroll + MAX_ROWS)
    for (let index = state.scroll; index < last; index += 1) {
      const selected = index === state.selected
      rows.push(
        Text({
          key: `item-${index}`,
          color: selected ? ORANGE_PALE : undefined,
          inverse: selected,
          children: ` ${selected ? '▶' : ' '} ${list[index]} `,
        }),
      )
    }
  }

  return Box({ key: 'skills', flexDirection: 'column', width: props.width, children: rows })
}

export default Skills
