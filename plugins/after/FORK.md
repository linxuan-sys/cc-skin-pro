# after (local fork)

Forked from [midudev/better-claude — after](https://github.com/midudev/better-claude/tree/main/plugins/after) 0.2.0, MIT, © Miguel Ángel Durán (midudev). Kept in step with upstream 0.2.0 (checked 2026-11-21: every file byte-identical except the changes below).

Local changes:

- Band open-bridge (below).

To take a later upstream release, copy its files over this folder and re-apply this change; re-check `hooks/register.tsx` and `types/index.d.ts`, which upstream may edit.

## Band open-bridge (2026-11-20)

- `hooks/register.tsx` adds an `engine.create` noun (`after.open`) whose hook opens this plugin's own pane, so cc-band-pro can open it mid-turn without a queued slash command. Ownership and drawing stay in this plugin, sidestepping the cross-plugin blank-pane regression (anthropics/claude-code#110615). The hook goes through the plugin's own `openPane()`, so `PANE_OPEN` is set and the above-prompt band yields while the pane is open, exactly as bare `/after` and the band's ✎ edit do. No existing behaviour changed; the slash command still works.
- `types/index.d.ts` declares the noun on `EngineInterface`.
