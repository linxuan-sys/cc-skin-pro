# cc-band-pro

cc-skin-pro's powerline bar, and nothing else, locked to Catppuccin Mocha. No
themes, no picker, no settings: one band above the prompt, six blocks, each a
click away from the plugin that owns its pane.

```
 󰚩 ⠹   ●●○○○ · 213k   replay 3   tree    marks    pi  
```

| Block | Shows | A click |
| --- | --- | --- |
| Thinking | The Claude glyph, with a spinner and a pink pulse while a turn runs | Opens the After queue pane (the `after` plugin) |
| Usage | The context meter and tokens; green to 30 %, yellow to 60 %, orange to 80 %, red past it | Runs `/ctx` |
| Replay | How many Edit and Write calls the last turn made | Opens cc-band-pro's own Diff pane: step through each edit, `p`/`n`, `↑↓` scroll, `c` or Esc closes |
| Tree | `tree` | Runs `/filetree` |
| Marks | A bookmark icon | Opens the Bookmarks pane (the `transcript-bookmarks` plugin) |
| Pi | ` pi` | Opens the Pi output pane (the `pi` plugin) |

## Commands

- `/band on` / `/band off` — show or hide the band. The choice is remembered across sessions.
- `/replay` — open the Diff pane on the last turn's edits.

## What it needs

- **A Nerd Font** in the terminal, for the powerline caps and the icons.
- **filetree**, **session-meter**, **after**, **transcript-bookmarks** and **pi** —
  optional. Each block opens its own plugin's pane; cc-band-pro only asks for
  it, so a block whose plugin is missing still draws, and a press does nothing at all.

## The Pi block

The last block, ` pi`, opens the Pi output pane. That pane belongs to a
separate plugin, **pi**, which cc-band-pro does not depend on.

Install it from its own marketplace:

```bash
claude plugin marketplace add linxuan-sys/cc-pi-team
claude plugin install pi@cc-pi-team
```

Without that plugin the block still draws, and a press does nothing at all: the
engine's hooks compiler refuses any read of `$` other than a `$.noun.event(...)`
call, so no plugin can ask whether another one is loaded.

## How it lives with the other bands

The prompt has one band slot, shared by every plugin that draws there. cc-band-pro
draws its bar and keeps whatever the plugins beneath it draw (`next(e)`), so the
skins mod's usage band and the rest stay where they were.

- Installed after skins, the skins band sits on top and this bar under it.
- A plugin above it in the chain that answers the band alone, as smart-compact
  does while it offers a compact, hides it until that offer is gone.
- Turn cc-skin-pro off: it draws the same bar, and two would stack.

## Clicks while Claude works

Every pane opens at once, mid-turn or not, and no press leaves a line in the
conversation. The Diff pane is cc-band-pro's own. The others are opened by
their ids, which works because each plugin keeps the state its pane draws from:
session-meter's reading comes from `session.measure` and filetree keeps its tree
following the cwd. When a
pane's render hook does not answer, or the layout cannot hold it (filetree wants
the fullscreen layout at 110 columns or more), the block falls back to the
plugin's command, and a command run from a plugin waits for the turn to end, so
that press is queued and a toast says so.

Typing `/filetree` yourself still opens it mid-turn, as that plugin allows.

## Files

- `hooks/register.tsx`: the hooks: band, diff recording, spinner, clicks.
- `hooks/bar.tsx`: the colors, icons, blocks and the powerline drawing.
- `hooks/diff.tsx`: the line diff and the Diff pane.
- `types/index.d.ts`: the state contract.

MIT licensed.
