# filetree (local fork)

Forked from [data-goblin/claude-code-filetree](https://github.com/data-goblin/claude-code-filetree), MIT, © Kurt Buhler. Kept in step with upstream 0.8.5 (upgraded 2026-11-20 from 0.8.3; 0.8.5 adds the right-click `copy` option, a dark-terminal theme and treemap label contrast, all adopted).

Local changes:

- `hooks/tree.ts`: `DEFAULT_THEME.accent` and `DARK_TERMINAL_THEME.accent` are `#cba6f7` (Catppuccin mauve) instead of upstream's `ansi256(4)`/`ansi256(12)`, so the tree's accent matches the Catppuccin skin on light and dark terminals.
- `.claude-plugin/plugin.json`: Open at start (`start`) defaults to `off` instead of upstream's `on`, and `hooks/register.tsx` treats anything but `on` as closed, so the pane stays closed until `/filetree`.
- Band open-bridge (below).

To take a later upstream release, copy its files over this folder and re-apply these changes; re-check `hooks/register.tsx` and `hooks/tree.ts`, which upstream may edit.

## Band open-bridge (2026-11-20)

- `hooks/register.tsx` adds an `engine.create` noun (`filetree.open`) whose hook calls `$.ui.open` on this plugin's own pane, so cc-band-pro can open it mid-turn without a queued slash command. Ownership and drawing stay in this plugin, sidestepping the cross-plugin blank-pane regression (anthropics/claude-code#110615). No existing behaviour changed; the slash command still works.
- `types/index.d.ts` declares the noun on `EngineInterface`.
