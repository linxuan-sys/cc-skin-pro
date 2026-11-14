# filetree (local fork)

Forked from [data-goblin/claude-code-filetree](https://github.com/data-goblin/claude-code-filetree), MIT, © Kurt Buhler. Kept in step with upstream 0.8.3.

Local changes:

- `hooks/tree.ts`: `DEFAULT_THEME.accent` is `#cba6f7` (Catppuccin mauve) instead of upstream's `ansi256(4)`, so the tree's accent matches the Catppuccin skin.
- `.claude-plugin/plugin.json`: Open at start (`start`) defaults to `off` instead of upstream's `on`, and `hooks/register.tsx` treats anything but `on` as closed, so the pane stays closed until `/filetree`.

To take a later upstream release, copy its files over this folder and re-apply these two changes; re-check `hooks/register.tsx`, which upstream may edit.
