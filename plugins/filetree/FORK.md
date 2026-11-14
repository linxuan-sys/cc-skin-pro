# filetree (local fork)

Forked from [data-goblin/claude-code-filetree](https://github.com/data-goblin/claude-code-filetree), MIT, © Kurt Buhler. Kept in step with upstream 0.8.3.

Local changes:

- `hooks/tree.ts`: `DEFAULT_THEME.accent` is `#cba6f7` (Catppuccin mauve) instead of upstream's `ansi256(4)`, so the tree's accent matches the Catppuccin skin. Nothing else differs from upstream.

To take a later upstream release, copy its files over this folder and keep that one line; upstream 0.8.3 does not touch `hooks/tree.ts`.
