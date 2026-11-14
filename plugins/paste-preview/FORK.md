# paste-preview (local fork)

Forked from [alan890104/claude-code-paste-preview](https://github.com/alan890104/claude-code-paste-preview) 0.2.0, MIT.

Local changes:

- the editor no longer opens automatically on paste; it opens only from the Edit button under a thumbnail;
- a sent message's thumbnails are appended under the row the plugins below draw, so skins keeps its prompt row;
- the above-prompt thumbnails are appended under the band the plugins below draw;
- it depends on `skins@cc-skin-pro` only to load before skins, so it can read the prompt text skins would otherwise blank.
