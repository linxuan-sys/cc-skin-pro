# find-model

A sidebar model picker for Claude Code: `/find-model` opens a pane whose list is the very
one `/model` shows — read from the merged settings' `modelPicker`, so a gateway's few hundred
models appear here too, not the built-in lineup.

The rows are drawn the way the file tree draws its own, and they behave the same way:

- **Click** a row to mark it; a **quick second click** or **Enter** switches to it.
- **↑ ↓ / j k**, Page Up/Down, Home and End walk the caret, which stays centred in the window.
- The **wheel** moves the window alone — the caret stays where you put it — and the **bar on
  the right** shows where in the list you are.
- **s** hands the keyboard to the search box, which filters by model id, label or name.
- **Esc** closes the pane; `/find-model` again toggles it.

Under the list sit the effort levels (`low`, `medium`, `high`, `xhigh`, `max`, `auto`), the one
in force ticked; pressing one runs `/effort` for this session.

Rows carry a purple number, and the model the session runs on is ticked in green.

No setup: the plugin needs no configuration and no network access.

MIT licensed.
