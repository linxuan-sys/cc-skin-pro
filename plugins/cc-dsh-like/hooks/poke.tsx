/**
 * Pointer layer over the portrait.
 *
 * Two rules that must not break:
 *   1. Draw nothing: every cell is a kitty U+10EEEE placeholder, one space erases the image.
 *   2. The caller must give `Client` explicit `width`/`height`, or this 0×0 module never gets mouse events.
 */
import type { ClientModule } from 'claude-code'

const Poke: ClientModule<Record<string, never>> = (_props, surface) => {
  // `acceptsPointer()` only becomes true on the second draw, so trigger that round.
  if (surface.state === undefined) {
    surface.onPointer(event => {
      if (event.type !== 'down') return
      if (event.button !== undefined && event.button !== 'left') return
      surface.post({ poke: true })
    })
    surface.setState({})
  }

  const { Box } = surface.elements
  return Box({ key: 'poke' })
}

export default Poke
