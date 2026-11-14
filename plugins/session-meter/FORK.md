# Local fork

- Upstream: [arasovic/claude-code-mods — session-meter](https://github.com/arasovic/claude-code-mods/tree/main/session-meter)
- Upstream version: `0.4.26`
- Forked: 2026-11-09
- License: MIT — see [LICENSE](LICENSE), copyright (c) 2026 Mehmet Aras

## What changed

- The plugin is installed as `session-meter`, and its tool/state namespace matches that name, so the engine accepts its writes:
  - `RESET_TOOL` is `mcp__session-meter__context_reset` (`hooks/register.tsx:23`).
  - The ten persisted atoms use `plugin: 'session-meter'` (`hooks/register.tsx:51-66`).
  - `types/index.d.ts` declares the `session-meter` plugin state.
  - The test helper and desktop mount use the same namespace.
- README image path points at this plugin's own `docs/session-meter.png`.
- No pane, threshold, compaction or persistence behaviour was changed.

## Why this copy exists

So an upstream release cannot change the behaviour under this installation. Update it by copying a newer upstream source deliberately, not automatically. The `/ctx` command, `autoOpen`, `contextAction`, `contextAt` and `commitNudge` options are unchanged.
