# 📌 Transcript Bookmarks for Claude Code

**Bookmark any part of a Claude Code conversation and jump straight back to it.**

In a long session (lots of prompts, replies and code edits), finding something said an hour ago means scrolling up through the transcript for a long time. This mod gives you bookmarks, as in a browser or an e-book reader:

1. **Mark** a message, or just the few lines you care about.
2. It's added to a **Bookmarks pane** that docks beside the conversation, like the diff panel does.
3. Click **Go to** and the transcript **scrolls back to that exact message**, so you can pick up from there. For a selection, the words you selected show in color; deep inside a long reply, a **▶** and a count under the prompt also tell you how far to scroll.

You can keep as many bookmarks as you like. Each one has its own **Delete** button, and they're saved with the session, so they come back when you resume it.

```
 ┌─ conversation ──────────────────────────────────┐ ┌─ Bookmarks ───────────────────────┐
 │                                                 │ │ [+ Bookmark selection] [Clear all]│
 │ > how should we cache the API responses?        │ │                                   │
 │                                                 │ │ claude · 14:32                    │
 │ ⏺ Two options: an in-memory LRU, or…        ★   │ │ Two options: an in-memory LRU, or │
 │                                                 │ │ a Redis layer in front of…        │
 │ ⏺ Edit(src/api/cache.ts)                    📌  │ │ [ Go to ] [ Delete ]              │
 │   └ Added 24 lines                              │ │                                   │
 │                                                 │ │ auth idea · selection · 15:07     │
 │                                                 │ │ refresh the token 60s before it   │
 │                                                 │ │ expires, not after the 401        │
 │                                                 │ │ [ Go to ] [ Delete ]              │
 └─────────────────────────────────────────────────┘ └───────────────────────────────────┘
  📌 appears when you hover a message · ★ marks the ones already bookmarked
```

---

## Contents

- [📌 Transcript Bookmarks for Claude Code](#-transcript-bookmarks-for-claude-code)
  - [Contents](#contents)
  - [What you can do](#what-you-can-do)
  - [Requirements](#requirements)
  - [Install](#install)
    - [From GitHub (recommended)](#from-github-recommended)
    - [From a local folder](#from-a-local-folder)
    - [Just try it, without installing](#just-try-it-without-installing)
  - [How to use it](#how-to-use-it)
    - [1. Bookmark a message](#1-bookmark-a-message)
    - [2. Bookmark a selection](#2-bookmark-a-selection)
    - [3. Jump back](#3-jump-back)
    - [4. Clean up](#4-clean-up)
    - [Opening and closing the pane](#opening-and-closing-the-pane)
  - [Examples](#examples)
  - [Commands](#commands)
  - [How bookmarks are kept](#how-bookmarks-are-kept)
  - [Privacy](#privacy)
  - [Troubleshooting](#troubleshooting)
  - [Known limitations](#known-limitations)
  - [Development](#development)
  - [Support](#support)
  - [License](#license)

---

## What you can do

| | |
|---|---|
| **Bookmark a whole message** | Hover any message (your prompt, Claude's reply, or a tool/edit row like `Edit(src/x.ts)`) and click the 📌 that shows up at its top right. |
| **Bookmark just some text** | Select a few lines with the mouse, then click **+ Bookmark selection** in the pane, or type `/bookmark`. Only the text you selected is kept. |
| **Give it a name** | `/bookmark auth idea` saves the selection under the label *auth idea*. |
| **Jump back** | Click **Go to** on a bookmark and the conversation scrolls so that message sits at the top. For a selection, the words you selected show in Claude Code's code color. Deep inside a long message, a **▶** marks the line you had at the top of the screen, and a count under the prompt goes down to 0 as you scroll to it. |
| **See what's bookmarked** | Bookmarked messages keep a small **★** at their top right. |
| **Delete** | Each bookmark has its own **Delete** button. **Clear all** removes every bookmark in the session. |
| **Keep them** | Bookmarks are saved with the session and come back on `claude --resume` / `claude --continue`. |

---

## Requirements

- **The Claude Code terminal.** This mod is built and tested only for Claude Code running in a terminal. The directory can also offer it in the desktop app's Code tab and in the IDE extensions (VS Code, JetBrains), but it hasn't been tested there. Some parts may work there and others may not, such as selecting text or jumping to a message.
- **Claude Code with plugin function hooks.** Tested on **2.1.291** and **2.1.322**. The hooks API is in early access and may change between releases.
- **Fullscreen terminal mode.** Hover marks, mouse selection and scroll-to-message all need it, because the classic "main screen" mode has no mouse tracking and leaves scrolling to your terminal. Turn it on in either of these ways:
  - add `"tui": "fullscreen"` to `~/.claude/settings.json`, or
  - start Claude Code with `CLAUDE_CODE_NO_FLICKER=1 claude`.

  Inside **tmux**, Claude Code uses the main screen by default, so you need one of the two settings above there too.
- **A wide enough window** for the pane to dock *beside* the conversation (110+ columns). In a narrower window the pane opens above the prompt instead, and everything still works.

---

## Install

### From GitHub (recommended)

This mod lives in [arcadeJHS/claude-code-mods](https://github.com/arcadeJHS/claude-code-mods). That repository is a plugin *marketplace*: it has a `.claude-plugin/marketplace.json` at its root that lists `transcript-bookmarks`. In a Claude Code session, type:

```
/plugin install transcript-bookmarks --marketplace arcadeJHS/claude-code-mods
```

Then:
1. answer **`y`** when asked to add the marketplace,
2. press **Enter** to pick the **user** scope (the mod is then active in every session).

You should see `✓ Installed transcript-bookmarks. Plugin is now active.` and can start bookmarking right away.

### From a local folder

Clone the repository, then add it as a marketplace and install from it:

```bash
git clone https://github.com/arcadeJHS/claude-code-mods.git
claude plugin marketplace add ./claude-code-mods   # the folder holding .claude-plugin/marketplace.json
claude plugin install transcript-bookmarks@matteo-mods
```

A plugin installed this way runs **from that folder**, not from a copy. After you edit its files, run `/reload-plugins` in your session to load the changes.

### Just try it, without installing

```bash
claude --plugin-dir ./claude-code-mods/transcript-bookmarks
```

This loads it for that session only, and reloads it whenever you save a file in the folder.

---

## How to use it

### 1. Bookmark a message

Move the mouse over any message in the conversation. A **📌** appears at the right end of its first line. Click it.

- The **Bookmarks** pane opens, with the new bookmark at the top.
- A short note confirms it: *Bookmarked: claude*.
- From then on the message shows a **★**, so you can tell it's bookmarked while you scroll.

Clicking ★ on a message that's already bookmarked doesn't add it twice. It just brings the pane up.

### 2. Bookmark a selection

Sometimes one sentence matters more than the whole reply.

1. **Select** the text with the mouse, as if you were going to copy it.
2. Then either:
   - click **+ Bookmark selection** at the top of the pane, or
   - type **`/bookmark`**, or **`/bookmark some label`** to name it.

The bookmark shows the selected text and is labelled `… · selection`. You can do this even while Claude is still answering.

> If your selection spans **several messages**, the bookmark is still saved (you keep the text), but it has no single message to jump to, so **Go to** just tells you so.

### 3. Jump back

Click **Go to** on any bookmark. The conversation scrolls until that message is at the top of the screen.

For a selection in one of Claude's replies, the words you selected show in Claude Code's code color (light blue-violet in the dark theme), so you can spot them. Only what you see changes: the saved conversation and what Claude reads stay the same. Words inside code blocks, tool output and your own prompts don't change color.

A selection can sit deep inside a message that is taller than the screen. Claude Code can only scroll a message into view by its top, so **Go to** brings you to the top of that message and then guides you the rest of the way:

1. A **▶** appears in the left margin of the line that was at the top of the screen when you selected the text.
2. A short note and a line under the prompt say how far it is: *▶ is 58 lines below the top of the window: scroll down*.
3. Scroll down. The count under the prompt follows you, line by line. If you go past, it says how far to scroll back up.
4. At 0 the screen shows what it showed when you selected the text, with **▶** on the top line and your selected words in color. A note says *this is where you selected the text*, and the count goes away.

The **▶** and the color stay until you click **Go to** again, **Delete** that bookmark, or click **Clear all**. The count stops if you scroll the message off the screen.

### 4. Clean up

- **Delete** removes one bookmark.
- **Clear all** removes every bookmark in this session.

### Opening and closing the pane

- **`/bookmarks`** opens the pane at any time.
- Close it with the pane's close mark, or **ctrl+x x**. Your bookmarks are kept.
- When you resume a session that has bookmarks, the pane opens by itself if the window is wide enough.

---

## Examples

**1. Find a decision again.**
Early in a session you ask *"how should we cache the API responses?"* and Claude compares an in-memory LRU with a Redis layer. You pick one and keep working. Before moving on, hover Claude's reply and click **📌**. Two hours and fifty messages later you want to re-read the trade-offs: click **Go to** on the `claude` bookmark, and the transcript scrolls straight back to that reply.

**2. Keep a command you'll need later.**
Claude gives you the exact command to run the database migration, but you won't run it until the end of the day. Select just the command with the mouse and type `/bookmark migration command`. The pane now shows *migration command · selection* with the command underneath, ready to copy, and **Go to** takes you to the reply it came from.

**3. Turn a long review into a to-do list.**
You ask Claude to review a pull request and get back a dozen points. Select each point you want to act on and click **+ Bookmark selection**. Each one becomes an entry in the pane. Work through them, using **Go to** for the full context, and **Delete** each one once it's fixed. When the pane is empty, you're done.

**4. Get back to a specific edit.**
Claude edited several files in one go, and later you want to look at the change to `src/api/cache.ts` again. Hover the `Edit(src/api/cache.ts)` row and click **📌**. The bookmark is titled `Edit(api/cache.ts)`, and **Go to** brings that edit's diff back on screen.

---

## Commands

| Command | What it does |
|---|---|
| `/bookmarks` | Opens the Bookmarks pane. |
| `/bookmark [label]` | Bookmarks the text currently selected with the mouse, optionally under `label`. |

Both commands work immediately, even while Claude is in the middle of a turn.

---

## How bookmarks are kept

- **Per session.** Each conversation has its own list.
- **Saved as you go.** Every add or delete is saved straight away in the plugin's own storage (Claude Code's per-plugin store, not your project files).
- **Restored on resume.** `claude --resume` / `--continue` brings back that session's bookmarks.
- **`/clear` starts fresh.** It begins a new conversation, so the list empties. The old conversation keeps its bookmarks for when you resume it.
- **`/resume` inside a session** swaps in the resumed conversation's bookmarks a moment later, without you doing anything.
- **Limits** (so storage stays small):
  - up to **200 bookmarks** per session,
  - up to **2,000 characters** of text per bookmark,
  - the **50 most recent sessions** with bookmarks are kept; older ones are dropped.

Nothing is sent anywhere, and the model never reads your bookmarks. They only change what you see on screen. [Privacy](#privacy) has the details.

---

## Privacy

Transcript Bookmarks works entirely on your computer. It sends nothing over the network.

**What it reads**
- **A message's text, only when you click its 📌.** That text becomes the bookmark.
- **The text you selected, only when you bookmark a selection** (with **+ Bookmark selection** or `/bookmark`).
- **Who wrote each message on screen**, so a selection can be labelled: `you`, `claude`, or a tool with its file or command, such as `Edit(api/cache.ts)`.
- **Where the screen stands in each message on screen**, as line numbers only (for example "lines 58 to 101 of 200"), so a selection deep in a long message can be found again.
- **The current session's id**, used only as the name your bookmarks are filed under.

It keeps the labels and line numbers for the last 500 messages drawn, in memory only. They're never saved and are gone when you quit Claude Code. It doesn't read your files, your project, your other conversations, or any message you haven't bookmarked.

**What it stores**
- For each bookmark: the text, its label, the time, which message it points to, and, for a selection in a long message, two line numbers (where the screen stood in that message).
- Where: Claude Code's local storage for this plugin, on your machine (`plugins/store/` in your Claude Code config folder, `~/.claude` by default), filed by session.
- How long: until you click **Delete** or **Clear all**. Bookmarks are kept for the 50 most recent sessions that have any, and older ones are deleted automatically.

**What it sends, and where**

| What | Where it goes | When |
|---|---|---|
| Your bookmarks | Claude Code's local plugin storage on this computer (`$.store.set`) | Each time you add or delete one |
| A bookmark's text | Your own clipboard, through Claude Code (`$.ui.copy`) | Only when **Go to** can't scroll to the message; a note on screen says so |
| Short notes, the pane and the **▶** count | Your screen (`$.ui.toast`, `$.ui.open`, `$.ui.status`, and drawing) | While you use the mod |

Nothing else leaves the mod. It makes no network requests (no `$.http`), runs no shell commands or processes, reads or writes no files of yours (no `$.fs`), calls no model, sends no messages to other sessions, runs no MCP servers and collects no telemetry. Nothing goes to Anthropic, to the author, or to anyone else. The model never sees your bookmarks.

**Every hook and call it makes**

Each hook and call below is part of Claude Code's own mods API. None comes from another plugin: this mod depends on no other plugin.

| Hook | What it does |
|---|---|
| `session.start` | Adds the `/bookmarks` and `/bookmark` commands, loads this session's saved bookmarks, and opens the pane if there are any. |
| `session.end` | After `/clear` or `/resume`, empties the list on screen and takes the **▶** off. Then it checks the session id every 250 ms (for up to 10 seconds) and loads the new session's saved bookmarks. The old session's bookmarks stay saved. |
| `command.run` with `{ command: 'bookmarks' }` | Runs only for the mod's own `/bookmarks` command. It opens the pane. It never sees, changes or blocks any other command, and the mod never makes a `command.run` call itself. |
| `command.run` with `{ command: 'bookmark' }` | Runs only for the mod's own `/bookmark` command. It bookmarks the selected text. It never sees, changes or blocks any other command, and the mod never makes a `command.run` call itself. |
| `ui.render` with `{ component: 'AssistantMessage' }`, `{ component: 'UserMessage' }` and `{ component: 'ToolUse' }` | Keeps Claude Code's own drawing of each message row and adds the 📌 / ★ button and the **▶** marker on top. It notes the row's author label and the line numbers on screen, as described above. For the reply that **Go to** jumped to for a selection, it wraps the selected words as inline code in the text Claude Code displays, so they show in its code color. It never changes the saved message or what the model reads. |
| `ui.render` with `{ component: 'Pane', requestId: 'bookmarks' }` | Draws the Bookmarks pane. |

The mod has no hook on your prompts, on tool calls, or on the model's turns.

| Call | What it does |
|---|---|
| `$.ui.selection()` | Claude Code's own call, part of its mods API, not another plugin's (the directory doesn't know it yet). It returns the text you last selected with the mouse and the id of the message the selection lies in. It reads only: it sends nothing anywhere. The mod calls it only when you bookmark a selection, and puts the text in the bookmark, which stays on this computer. |
| `$.session.id()` | Gets the current session's id, used only as the name your bookmarks are filed under in local storage. It is never sent anywhere. |
| `$.store.get`, `$.store.set`, `$.store.delete` | Read and write the plugin's local storage on your machine. |
| `$.state.get`, `$.state.set` | Keep the list and the **▶** marker in memory for the session, so the pane and the rows redraw when they change. |
| `$.ui.open` | Opens the Bookmarks pane. |
| `$.ui.toast` | Shows short notes, such as *Bookmarked: claude*. |
| `$.ui.status` | Shows the **▶** count under the prompt while you scroll to it, and clears it at 0. |
| `$.ui.resolve` | Gets the elements (box, text, button) to draw with. |
| `$.ui.scroll` | Scrolls the conversation to a bookmarked message. |
| `$.ui.copy` | Copies a bookmark's text to your clipboard, only when **Go to** can't scroll. |
| `$.clock.now` | Reads the time shown on each bookmark. |
| `$.clock.every` | After `/clear` or `/resume`, checks every 250 ms whether the new session has started, for up to 10 seconds. |
| `$.command.register` | Adds the `/bookmarks` and `/bookmark` commands. |

The source is all in [`hooks/register.tsx`](hooks/register.tsx), [`hooks/guide.ts`](hooks/guide.ts) and [`hooks/highlight.ts`](hooks/highlight.ts), unminified, if you want to check.

---

## Troubleshooting

**I don't see the 📌 when I hover a message.**
You're probably on the main screen rather than fullscreen. See [Requirements](#requirements). Inside tmux, fullscreen is off by default.

**`/bookmark` says "Nothing is selected".**
Select the text with the mouse *first*, then run the command. The selection is remembered until you select something else or run your next prompt.

**Go to brings me to the top of a long message, not to the text I selected.**
That is how Claude Code scrolls: a message comes into view by its top. Look for the **▶** in the left margin and scroll down until the count under the prompt reaches 0. If there's no **▶**, the top of the message was on screen when you selected the text, so the text is in the first screen of the message. Bookmarks made with versions before 0.3.0 have no **▶**.

**"Can't scroll to that message (…). Its text is on the clipboard."**
The message is no longer part of the drawn conversation, for example after `/compact`. The mod copies the bookmarked text to your clipboard so you can still use it.

**The pane opens above the prompt instead of on the side.**
The window is narrower than about 110 columns. Widen it and the pane docks beside the conversation.

**Nothing happens at all.**
Check that the mod is loaded with `claude plugin list`, or start with `claude --debug`. If a hook fails, Claude Code writes a line naming the `transcript-bookmarks` plugin and the reason.

---

## Known limitations

- **Terminal only, in fullscreen mode.** It's tested only in the Claude Code terminal; see [Requirements](#requirements) for the desktop app and IDE extensions. Hover, selection and jumping need fullscreen mode. On the main screen the mod stays out of the way and draws nothing on messages.
- **Go to scrolls to a message's top.** Claude Code's mods API can't scroll to a line inside a message, so a selection deep in a long message gets the **▶** and the count, and you scroll the last part yourself. If you resize the window between selecting and jumping, the message wraps differently and the **▶** lands near, not on, the line.
- **Select, then bookmark, without scrolling in between.** The mod reads where the screen stood when you run `/bookmark` or press **+ Bookmark selection**. If the selected text has scrolled off the screen by then, Claude Code doesn't say which message it was in, and the bookmark has no place to jump to.
- **Jumping needs the message to still be in the conversation view.** After a `/compact`, older messages are summarised, so their bookmarks can no longer jump (you get the text on the clipboard instead).
- **Grouped tool rows.** When several reads or searches are folded into one group row, the group has no 📌 of its own. Bookmark the reply next to it, or select the text.
- **Early-access API.** Plugin function hooks are new in Claude Code and may change in future releases.

---

## Development

```
transcript-bookmarks/
├── .claude-plugin/
│   └── plugin.json          # name, version, description, type contract
├── hooks/
│   ├── hooks.json           # points Claude Code at register.tsx
│   ├── register.tsx         # the mod: hover marks, pane, commands, storage, Go to
│   ├── guide.ts             # the ▶ count: plain functions of the line numbers on screen
│   └── highlight.ts         # colors a selection's words in a reply's markdown
├── types/
│   └── index.d.ts           # the shape of the state the mod keeps
├── tests/
│   ├── transcript-bookmarks.test.tsx   # runs against Claude Code's own engine
│   └── highlight.test.ts               # the highlight on plain text, lists, links, code, tables
├── tsconfig.json            # extends the types Claude Code writes on load
└── README.md
```

**How it works, briefly**

- It hooks the drawing of each transcript row (`AssistantMessage`, `UserMessage`, `ToolUse`). It keeps Claude Code's own drawing of the row and adds a small hover-revealed button on top, which doesn't shift the layout.
- `$.ui.selection()` gives the selected text and the message it belongs to.
- Each row's `onScreen` (which of its lines the screen shows) tells where the screen stood when a selection was bookmarked.
- `$.ui.scroll({ to: { requestId } })` scrolls the conversation to a message's top. For a selection deeper down, the row draws a **▶** on the line that was at the top of the screen, and each new `onScreen` report updates the count in `$.ui.status`. The reply's displayed `text` is rewritten with the selected words wrapped as inline code; only words change, so its lines wrap as before.
- The list lives in session state (so it survives a mod reload) and is copied to the plugin store under the session id (so it survives a restart).

**Check, test, run**

```bash
claude plugin validate ./transcript-bookmarks   # manifest + hooks, the way Claude Code reads them
claude plugin test ./transcript-bookmarks       # the tests in tests/
claude --plugin-dir ./transcript-bookmarks      # a live session that reloads on save
tsc -p ./transcript-bookmarks                   # type-check (after Claude Code has loaded the mod once)
```

`.claude-plugin/types/` is written by Claude Code each time it loads the mod (it holds the API's type declarations for your editor). It is git-ignored.

---

## Support

- **Bugs, questions and ideas:** open an issue at [github.com/arcadeJHS/claude-code-mods/issues](https://github.com/arcadeJHS/claude-code-mods/issues). It helps to include your Claude Code version (`claude --version`), whether you run fullscreen mode, and the steps that show the problem.
- **Security concerns:** please report them privately through [GitHub's security advisories](https://github.com/arcadeJHS/claude-code-mods/security/advisories/new) rather than in a public issue.

---

## License

[WTFPL](LICENSE): Do What The Fuck You Want To Public License, version 2. Copy it, change it, ship it, do whatever you want with it.
