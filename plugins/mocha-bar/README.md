# mocha-bar

cc-skin-pro's powerline bar, and nothing else, locked to Catppuccin Mocha. No
themes, no picker, no settings: one band above the prompt, six blocks, each a
click away from the plugin that owns its pane.

```
 󰚩 ⠹  Opus 5.5 · high   diff 3   tree    marks   ●●○○○ · 213k 
```

| Block | Shows | A click |
| --- | --- | --- |
| Thinking | The Claude glyph — or the crab's picture, on a terminal with the image protocol: at its laptop while Claude works, resting otherwise — with a spinner and a pink pulse while a turn runs | Opens the After queue pane (the `after` plugin) |
| Model | The model's name (its `modelPicker` label where the settings give one) and the effort | Runs `/find-model` |
| Diff | How many Edit, MultiEdit and Write calls the last turn made | Opens mocha-bar's own Diff pane: step through each edit, `p`/`n`, Esc closes |
| Tree | `tree` | Runs `/filetree` |
| Marks | A bookmark icon | Opens the Bookmarks pane (the `transcript-bookmarks` plugin) |
| Usage | The context meter and tokens; green to 30 %, yellow to 60 %, orange to 80 %, red past it | Runs `/ctx` |

## What it needs

- **A Nerd Font** in the terminal, for the powerline caps and the icons.
- **find-model**, **filetree**, **session-meter**, **after** and **transcript-bookmarks**,
  for the model, tree, usage, thinking and marks blocks. mocha-bar only opens their panes, so each
  stays in, and is kept up in, its own plugin. A block whose plugin is off says
  so in a toast.
- The crab's two pictures ship in `assets/`; a terminal with the image protocol
  (kitty, Ghostty, iTerm2 3.5+) draws one in the thinking block, and elsewhere
  the block wears the Claude glyph instead.

## How it lives with the other bands

The prompt has one band slot, shared by every plugin that draws there. mocha-bar
draws its bar and keeps whatever the plugins beneath it draw (`next(e)`), so the
skins mod's usage band and the rest stay where they were.

- Installed after skins, the skins band sits on top and this bar under it.
- A plugin above it in the chain that answers the band alone, as smart-compact
  does while it offers a compact, hides it until that offer is gone.
- Turn cc-skin-pro off: it draws the same bar, and two would stack.

## Clicks while Claude works

Every pane opens at once, mid-turn or not, and no press leaves a line in the
conversation. The Diff pane is mocha-bar's own. The other three are opened by
their ids, which works because each plugin keeps the state its pane draws from:
session-meter's reading comes from `session.measure`, find-model reads its list
in as a session starts, and filetree keeps its tree following the cwd. When a
pane's render hook does not answer, or the layout cannot hold it (filetree wants
the fullscreen layout at 110 columns or more), the block falls back to the
plugin's command, and a command run from a plugin waits for the turn to end, so
that press is queued and a toast says so.

Typing `/find-model` or `/filetree` yourself still opens them mid-turn, as those
plugins allow.

## Files

- `hooks/register.tsx`: the hooks: band, diff recording, spinner, clicks.
- `hooks/bar.tsx`: the colors, icons, blocks and the powerline drawing.
- `hooks/diff.tsx`: the line diff and the Diff pane.
- `assets/crab.png`, `assets/crab-typing.png`: the thinking block's two pictures.
- `types/index.d.ts`: the state contract.

MIT licensed.
