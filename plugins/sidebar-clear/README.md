# sidebar-clear

Makes plugin sidebars see-through, so your terminal's own background — and its opacity — shows through instead of the theme's solid gray.

Claude Code paints a docked pane's surround with the theme key `composerSidebarBackground` (`rgb(38,38,38)` in the dark base theme, and no skin overrides it). A pane that names `transparent` as its background makes the engine paint nothing under it instead, so whatever is behind the terminal shows.

Most panes never name a background at all. This plugin sits above their `ui.open` and fills one in:

- A pane that already chose a background, or chose `transparent`, is left alone.
- `settings` and `changes` are skipped: dialogs you answer and leave read better on the theme's surround.

That is the whole plugin — `hooks/register.tsx` is about twenty lines.

## Install

```sh
claude plugin marketplace add linxuan-sys/cc-skin-pro
claude plugin install sidebar-clear@cc-skin-pro
```

## Pairs with

[`cc-skin-pro`](https://github.com/linxuan-sys/cc-skin-pro)'s file tree, which never names a background: with both installed, the tree sits on your terminal's own background rather than a gray box.

## Licence

MIT.
