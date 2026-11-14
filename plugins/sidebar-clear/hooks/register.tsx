// sidebar-clear: draws plugin sidebars with no background of their own.
//
// Claude Code paints a docked pane's surround with the theme key
// `composerSidebarBackground` (rgb(38,38,38) in the dark base theme, which no
// skin overrides). A pane that names `transparent` as its background instead
// makes the engine paint nothing under it, so the terminal's own background —
// and its opacity — shows through.
//
// filetree never names one, so this mod sits above its `ui.open` and adds it.
// Panes that already chose a background, or `transparent`, are left alone.

import type { Register } from 'claude-code'

// Panes to leave alone: the ones that paint their own ground, or that the
// person reads best with the theme's surround (dialogs they answer and leave).
const SKIP = new Set(['settings', 'changes'])

export const register: Register = (on) => {
  on('ui.open', async ($, e, next) => {
    // Only fill in what the opener left out; a pane's own choice always wins.
    if (e.backgroundColor !== undefined) return next(e)
    if (SKIP.has(e.id)) return next(e)
    return next({ ...e, backgroundColor: 'transparent' })
  }).catch(($, e, next) => next(e))
}
