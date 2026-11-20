import type { ClientModule, RenderElement } from 'claude-code'

export type Seg = { t: string; c?: string; b?: boolean }
export type RowSpec = { id: string; left: Seg[]; right: Seg[] }
export type RowsProps = {
  rows: RowSpec[]
  active: string
  activeBg: string
  hoverBg: string
  bar?: { pos: number; size: number; thumb: string; track: string }
}
type Local = { hover: number; drag: boolean; ref: { unpoint?: () => void } }

const TREE_BUDGET = 70_000
const MAX_ROWS = 1_500

const Rows: ClientModule<RowsProps, Local> = (props, surface) => {
  const { Box, Text } = surface.elements
  let state = surface.state
  if (state === undefined) {
    state = { hover: -1, drag: false, ref: {} }
    surface.setState(state)
  }
  let visible = props.rows.length
  state.ref.unpoint = surface.onPointer(e => {
    const cur = surface.state ?? state
    const span = Math.max(1, props.rows.length - 1)
    const onBar = Boolean(props.bar) && e.x >= surface.columns - 1
    if (props.bar && (cur.drag || (onBar && e.type === 'down' && (e.button ?? 'left') === 'left'))) {
      if (e.type === 'up' || e.type === 'leave') {
        surface.setState({ ...cur, drag: false })
        return
      }
      if (e.type === 'down' || e.type === 'move') {
        if (!cur.drag) surface.setState({ ...cur, drag: true, hover: -1 })
        surface.post({ scrollTo: Math.max(0, Math.min(1, e.y / span)) })
        return
      }
    }
    if (e.type === 'leave' || e.y < 0 || e.y >= visible) {
      if (cur.hover !== -1) surface.setState({ ...cur, hover: -1 })
      return
    }
    if (e.type === 'move' && !e.button && cur.hover !== e.y) surface.setState({ ...cur, hover: e.y })
    const row = props.rows[e.y]
    if (e.type !== 'down' || (e.button ?? 'left') !== 'left' || !row) return
    if (row.id) surface.post({ press: row.id })
  })
  surface.onKey(e => surface.post({ key: e.key }))
  const draw = (s: Seg) => (
    <Text color={s.c || undefined} bold={s.b}>
      {s.t}
    </Text>
  )
  const rowEl = (r: RowSpec, i: number) => (
    <Box
      flexDirection="row"
      height={1}
      overflow="hidden"
      backgroundColor={r.id && r.id === props.active ? props.activeBg : r.id && i === state.hover ? props.hoverBg || undefined : undefined}
    >
      <Box flexShrink={1} overflow="hidden">
        {r.left.map(draw)}
      </Box>
      <Box flexGrow={1} />
      {r.right.map(draw)}
      {props.bar && (
        <Text color={(i >= props.bar.pos && i < props.bar.pos + props.bar.size ? props.bar.thumb : props.bar.track) || undefined}>
          {i >= props.bar.pos && i < props.bar.pos + props.bar.size ? '┃' : '│'}
        </Text>
      )}
    </Box>
  )
  const drawn: RenderElement[] = []
  let size = 0
  for (const [i, spec] of props.rows.entries()) {
    const el = rowEl(spec, i)
    let cost = 1_000
    try {
      cost = JSON.stringify(el).length
    } catch {}
    if (size + cost > TREE_BUDGET || drawn.length >= MAX_ROWS) {
      visible = i
      drawn.push(<Text dimColor>{`  … ${props.rows.length - i} more rows, use search`}</Text>)
      break
    }
    size += cost
    drawn.push(el)
  }
  return <Box flexDirection="column">{drawn}</Box>
}

export default Rows
