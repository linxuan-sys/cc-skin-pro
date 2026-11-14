# cc-dsh-like

A dsh-TUI style start page for Claude Code.

Open a new session and, at the top of the transcript, you get:

- **The Claude-girl portrait**, drawn as a terminal image, who switches to a cute look (撒娇) for a moment when you click her.
- **A `CLAUDE` / `CODE` dot-matrix wordmark** under her, in a three-step orange gradient. On a narrow terminal it becomes a two-row `CLA` / `UDE` version, and the wordmark drops out entirely below that.
- **A one-line motto** under the wordmark. Click it to cycle to the next one; after the last it wraps around.
- **A Skills banner**: a dropdown of the skills you have in `~/.claude/skills` and your project's `.claude/skills`. Pick one and press Enter to run it (it runs as a slash command, so a skill named `review` runs `/review`); typing filters the list.

The page is placed once, at `session.start`, and scrolls up with the conversation like any other message. A `--resume` or `/clear` does not insert it again.

## Install

```sh
claude plugin marketplace add linxuan-sys/cc-skin-pro
claude plugin install cc-dsh-like@cc-skin-pro
```

## Making it yours

Everything is at the top of `hooks/register.tsx`:

| Want to change | Look for |
|---|---|
| How wide the portrait is | `WANT_COLUMNS` |
| How long she acts cute after a click | `CUTE_MS` |
| The wordmark's rows | `BIG_TOP_ROWS` / `BIG_BOTTOM_ROWS` (wide), `NARROW_TOP_ROWS` / `NARROW_BOTTOM_ROWS` (narrow) |
| The wordmark's colors | `BIG_FROM` / `BIG_MID` / `BIG_TO` |
| The mottos | `LOVE_TEXTS` |
| The portrait itself | replace the two PNGs in `assets/` |

## How it is drawn

`Placed` rows cannot take a mouse, and a `<Button>` in one does not fire, so each interactive piece is a `Client` region that handles its own pointer and keys: `hooks/poke.tsx` (the click layer over the portrait), `hooks/love.tsx` (the motto line), `hooks/skills.tsx` (the banner).

The portrait is drawn by the engine as an image, one cell per `U+10EEEE` placeholder; the click layer must paint no cell at all, or it would erase the image, and it needs an explicit `width`/`height` from the caller, since an empty module measures 0×0 and the pointer never lands.

## Licence

MIT.
