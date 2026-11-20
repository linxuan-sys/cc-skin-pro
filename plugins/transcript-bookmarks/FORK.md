# transcript-bookmarks (local fork)

Forked from [arcadeJHS/claude-code-mods](https://github.com/arcadeJHS/claude-code-mods) 0.3.0, WTFPL, © Matteo Piazza.

Local changes:

- the 📌 is always visible at a row's top right, instead of showing only on hover; it stays ★ once the row is bookmarked;
- the pin and star are Nerd Font glyphs (`fa-thumbtack` U+F08D, `fa-star` U+F005) instead of the 📌 and ★ text glyphs;
- the Bookmarks pane renders each saved excerpt through skins' Markdown renderer (`$.skins.markdown`), and falls back to the plain preview lines when that call is unavailable or fails;
- it depends on `skins@cc-skin-pro`: the dependency loads this plugin before skins, so skins' row hooks don't swallow the always-visible 📌, and the pane can borrow the renderer.

## Band open-bridge (2026-11-20)

- `hooks/register.tsx` adds an `engine.create` noun (`bookmarks.open`) whose hook calls `$.ui.open` on this plugin's own pane, so cc-band-pro can open it mid-turn without a queued slash command. Ownership and drawing stay in this plugin, sidestepping the cross-plugin blank-pane regression (anthropics/claude-code#110615). No existing behaviour changed; the slash command still works.
- `types/index.d.ts` declares the noun on `EngineInterface`.
