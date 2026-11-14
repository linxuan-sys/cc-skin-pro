# transcript-bookmarks (local fork)

Forked from [arcadeJHS/claude-code-mods](https://github.com/arcadeJHS/claude-code-mods) 0.3.0, WTFPL, © Matteo Piazza.

Local changes:

- the 📌 is always visible at a row's top right, instead of showing only on hover; it stays ★ once the row is bookmarked;
- the Bookmarks pane renders each saved excerpt through skins' Markdown renderer (`$.skins.markdown`), and falls back to the plain preview lines when that call is unavailable or fails;
- it depends on `skins@cc-skin-pro`: the dependency loads this plugin before skins, so skins' row hooks don't swallow the always-visible 📌, and the pane can borrow the renderer.
