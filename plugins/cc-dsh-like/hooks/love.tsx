/**
 * Tagline row under the wordmark. Click cycles to the next line, wrapping around.
 *
 * `<Text>` inside a `Placed` row gets no mouse events, so this goes through `Client`.
 * Each frame refills the whole row with spaces, or a shorter line leaves stale
 * characters from the previous one behind.
 */
import type { ClientModule } from 'claude-code'

export type LoveProps = {
  texts: readonly string[]
  width: number
}

type LoveState = { index: number }

const ORANGE = '#e68a69'

/**
 * Padding uses NBSP (U+00A0) instead of plain spaces — plain spaces are skipped
 * as whitespace by the renderer, and stale characters from the previous line survive.
 */
const NBSP = ' '

const center = (text: string, width: number): string => {
  if (text.length >= width) return text.slice(0, width)
  const left = Math.floor((width - text.length) / 2)
  return NBSP.repeat(left) + text + NBSP.repeat(width - text.length - left)
}

/** `onPointer` is attached once and captures first-frame props, so refresh this every redraw. */
let latest: LoveProps = { texts: [], width: 0 }

const Love: ClientModule<LoveProps, LoveState> = (props, surface) => {
  latest = props

  if (surface.state === undefined) {
    surface.onPointer(event => {
      if (event.type !== 'down') return
      if (event.button !== undefined && event.button !== 'left') return
      const state = surface.state
      if (state === undefined) return
      const count = latest.texts.length
      if (count === 0) return
      surface.setState({ index: (state.index + 1) % count })
    })
    surface.setState({ index: 0 })
  }

  const { Box, Text } = surface.elements
  const index = surface.state?.index ?? 0
  const text = props.texts[index] ?? ''

  return Box({
    key: 'love',
    flexDirection: 'row',
    width: props.width,
    children: [Text({ key: 'text', color: ORANGE, children: center(text, props.width) })],
  })
}

export default Love
