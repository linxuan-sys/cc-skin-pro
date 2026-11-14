# cc-skin-pro

**English** | [中文](#中文说明)

![cc-skin-pro](docs/cc-skin-pro-poster.png)

A hand-picked Claude Code marketplace: the **skins** engine, the **cc-band-pro**
powerline band, and the panes and tools that make them useful — a start page, a file
tree, a model picker, context and usage, a prompt queue, bookmarks, test results,
compaction and a mod store.

Some of these plugins are original to this marketplace, some are forks of community
mods, and the rest are hellosverre's suite carried here so one marketplace holds a
complete setup. The forks are not cosmetic copies: their dependency IDs point at this
marketplace, their load order is solved (transcript-bookmarks and paste-preview load
before skins so the skin's row hooks cannot swallow their output; the band declares its
companions), and their panes are kept from fighting over the same slot. Each one is
tracked against its upstream release so updates are deliberate rather than accidental.

**Original here:** cc-band-pro, find-model, cc-dsh-like, sidebar-clear.
**Local forks:** filetree, session-meter, after, transcript-bookmarks, paste-preview.
**hellosverre's suite:** skins, redgreen, smart-compact, mod-store.

## 1. skins

![skins](docs/skins.png)

The skin engine. It redraws what Claude Code shows you: tool calls with icons and
timings, edits as diff cards, code, tables, Mermaid diagrams and math as cards, links,
folding, and a prompt outline in the skin's colours. Sixteen themes ship with it —
Noir, Catppuccin, Tokyo Night, Dracula, Rosé Pine, Gruvbox, Nord, Kanagawa and more —
and `/skin` switches them live. `/skin` also opens the settings pane: rail, shimmer,
tables, icons, markdown, charts, fold, quiet, calm and the usage band. Skins can be
repainted, designed from scratch with Claude, pinned per folder and shared as files.

It is the base the rest of this marketplace leans on: transcript-bookmarks renders its
excerpts through `$.skins.markdown`, and paste-preview loads before it so the skin's
prompt row survives. One local default differs from upstream: the usage band is off by
default; `/skin band on` brings it back.

Upstream: [hellosverre/claude-skins](https://github.com/hellosverre/claude-skins) (MIT).

## 2. cc-band-pro

![cc-band-pro](docs/cc-band-pro-idle.png)
![cc-band-pro while Claude works](docs/cc-band-pro-runing.png)

The powerline band above the prompt, locked to Catppuccin Mocha. Six blocks — thinking
(the crab's picture where the terminal draws images, the Claude glyph elsewhere), model,
diff count, tree, bookmarks and context usage. Each block opens its plugin's pane at
once, mid-turn, without leaving a line in the conversation. The band is thin by design:
the panes belong to find-model, filetree, session-meter, after and transcript-bookmarks,
which it declares as dependencies.

By [Linxuan](https://github.com/linxuan-sys). Original to this marketplace.

## 3. cc-dsh-like

![cc-dsh-like](docs/cc-dsh-like.png)

A dsh-TUI style start page at the top of every new session: the Claude-girl portrait
(click her and she acts cute), a `CLAUDE` / `CODE` dot-matrix wordmark, a clickable
motto line, and a skills dropdown that runs any skill from `~/.claude/skills` or the
project's `.claude/skills`. It is placed once, at session start, and scrolls up with
the conversation like any other message.

By [Linxuan](https://github.com/linxuan-sys). Original to this marketplace.

## 4. sidebar-clear

![sidebar-clear](docs/sidebar-clear.png)

Makes plugin sidebars see-through. Claude Code paints a docked pane's surround with the
theme's `composerSidebarBackground`; this plugin fills in `transparent` for panes that
never name a background, so the terminal's own background and opacity show through.
`settings` and `changes` are skipped, since dialogs read better on the theme's surround.

By [Linxuan](https://github.com/linxuan-sys). Original to this marketplace.

## 5. paste-preview

![paste-preview](docs/paste-preview.png)

Shows the images you paste instead of only the `[Image #N]` placeholder: thumbnails
above the prompt and under sent messages, each labelled. In this fork the editor no
longer opens automatically on paste — it opens from the **Edit** button under a
thumbnail — and the thumbnails are appended under the row skins draws. It depends on
skins to load first, so it can read the original `[Image #N]` text the skin would
otherwise blank.

Fork of [alan890104/claude-code-paste-preview](https://github.com/alan890104/claude-code-paste-preview) (MIT).

## 6. filetree

![filetree](docs/filetree.png)

An IDE-style file tree docked beside the conversation: git status, file previews, and
the files Claude reads, writes and commits shimmering while it works, with search,
keyboard navigation and a split preview. This fork uses the Catppuccin mauve accent and
keeps the pane closed by default; `/filetree` opens it.

Fork of [data-goblin/claude-code-filetree](https://github.com/data-goblin/claude-code-filetree) (MIT).

## 7. find-model

![find-model](docs/find-model.png)

A sidebar model picker: `/find-model` opens the same list `/model` shows, read from the
merged settings, with search by id, label or name and click, Enter or `j`/`k` to switch.
Under the list sit the effort levels, and picking one runs `/effort` for the session.

By [Linxuan](https://github.com/linxuan-sys). Original to this marketplace.

## 8. session-meter

![session-meter](docs/session-meter.png)

A docked pane for the session's own measurements: the context window broken down by
category, usage limits with pace, tool calls and model requests. It can also send the
model a one-time note near a threshold, suggest or perform `/compact`, and keep a short
history. Here `autoOpen` defaults to off; `/ctx` opens the pane.

Fork of [arasovic/claude-code-mods — session-meter](https://github.com/arasovic/claude-code-mods/tree/main/session-meter) (MIT).

## 9. after

![after](docs/after.png)

A real prompt queue: `/after <task>` queues work to run after the current task, without
steering Claude. The queue is visible on a band above the prompt and editable in a pane,
and plain language works too (`/after remove the tests one`). No Node.js, no background
processes — the mod runs inside Claude Code.

Fork of [midudev/better-claude](https://github.com/midudev/better-claude) (MIT).

## 10. transcript-bookmarks

![transcript-bookmarks](docs/transcript-bookmarks.png)

Bookmark a message or a selected passage and jump back to it from a side pane; bookmarks
are saved with the session and come back when you resume it. This fork keeps the 📌
always visible on every message and renders each bookmark through skins' Markdown
renderer, falling back to plain lines when the skin is off. It depends on skins so it
loads before the skin's row hooks.

Fork of [arcadeJHS/claude-code-mods — transcript-bookmarks](https://github.com/arcadeJHS/claude-code-mods/tree/main/transcript-bookmarks) (WTFPL).

## 11. redgreen

![redgreen](docs/redgreen.png)

When Claude runs tests, failures land in a pane beside the chat: the failing tests by
name, the picked one in full with its assertion diff, and the runs before it. It reads
vitest, jest, pytest, cargo, go, bun, deno and the usual npm/pnpm/yarn wrappers; a green
run only updates the status line, so the pane stays out of the way.

Upstream: [hellosverre/redgreen](https://github.com/hellosverre/redgreen) (MIT).

## 12. smart-compact

![smart-compact](docs/smart-compact.png)

Offers compaction at the right moment instead of when the context is already full: after
a commit or green tests, before the prompt cache expires, or when Claude itself says it
is done with what came before. A dialog above the prompt shows what the summary must
keep; you press Compact when you agree.

Upstream: [hellosverre/smart-compact](https://github.com/hellosverre/smart-compact) (MIT).

## 13. mod-store

![mod-store](docs/mod-store.png)

An app store for Claude Code mods in a pane: `/mods` browses and searches about 2,700
community mods, shows what each one can access before you install, and installs with one
click. Claude can search and compare mods for you, but never installs one itself.

Upstream: [hellosverre/mod-store](https://github.com/hellosverre/mod-store) (MIT).

## Install

Add the marketplace once:

```sh
claude plugin marketplace add linxuan-sys/cc-skin-pro
```

Then install the plugins:

```sh
claude plugin install skins@cc-skin-pro
claude plugin install cc-band-pro@cc-skin-pro
claude plugin install cc-dsh-like@cc-skin-pro
claude plugin install sidebar-clear@cc-skin-pro
claude plugin install paste-preview@cc-skin-pro
claude plugin install filetree@cc-skin-pro
claude plugin install find-model@cc-skin-pro
claude plugin install session-meter@cc-skin-pro
claude plugin install after@cc-skin-pro
claude plugin install transcript-bookmarks@cc-skin-pro
claude plugin install redgreen@cc-skin-pro
claude plugin install smart-compact@cc-skin-pro
claude plugin install mod-store@cc-skin-pro
```

Run `/reload-plugins` afterwards, or restart Claude Code. `skins` is installed first
because transcript-bookmarks and paste-preview depend on it; `cc-band-pro` declares its
five companion plugins as dependencies, and Claude Code installs those with it.

Claude Code 2.1.306 or newer is recommended — filetree needs it, smart-compact needs
2.1.295, redgreen 2.1.293, and skins 2.1.287.

## Credits

This marketplace stands on the work of its upstream authors. Thank you to:

- [hellosverre](https://github.com/hellosverre) for skins, redgreen, smart-compact and mod-store;
- [Kurt Buhler](https://github.com/data-goblin) for claude-code-filetree;
- [Mehmet Aras](https://github.com/arasovic) for session-meter;
- [Miguel Ángel Durán](https://github.com/midudev) for better-claude (after);
- [Matteo Piazza](https://github.com/arcadeJHS) for transcript-bookmarks;
- [alan890104](https://github.com/alan890104) for paste-preview.

Each plugin keeps the license its upstream gave it: MIT, except transcript-bookmarks
(WTFPL). The marketplace itself is MIT — see [LICENSE](LICENSE).

---

# 中文说明

一个精挑细选的 Claude Code 插件商店：**skins** 皮肤引擎、**cc-band-pro** powerline 横幅，以及让它们好用的那些面板和工具——起始页、文件树、模型选择器、上下文与用量、提示词队列、书签、测试结果、智能压缩和 mod 商店。

这里的插件有的由本站原创，有的是社区插件的 fork，其余是 hellosverre 的套件。收进同一个商店，装齐就是一套完整环境。fork 不是换个皮：依赖 ID 都指向这个商店，加载顺序已经解决（transcript-bookmarks 和 paste-preview 排在 skins 前面，避免被皮肤的整行钩子吞掉；band 把它的伙伴声明为依赖），面板之间不会抢同一个位置；每个都对照上游版本跟踪，更新是有意为之，不会悄悄漂移。

**本站原创：** cc-band-pro、find-model、cc-dsh-like、sidebar-clear。
**本地 fork：** filetree、session-meter、after、transcript-bookmarks、paste-preview。
**hellosverre 套件：** skins、redgreen、smart-compact、mod-store。

## 1. skins

![skins](docs/skins.png)

皮肤引擎。它重画 Claude Code 显示给你的一切：带图标和耗时的工具调用、diff 卡片、代码、表格、Mermaid 图和数学卡片、链接、折叠，以及皮肤配色的提示符描边。内置十六套主题——Noir、Catppuccin、Tokyo Night、Dracula、Rosé Pine、Gruvbox、Nord、Kanagawa 等——用 `/skin` 实时切换。`/skin` 也会打开设置面板：rail、shimmer、表格、图标、markdown、图表、折叠、安静模式、calm 和用量条。皮肤可以重绘、让 Claude 从零设计、按文件夹 pin，也可以导出成文件分享。

它是这个商店的地基：transcript-bookmarks 通过 `$.skins.markdown` 渲染书签正文，paste-preview 排在它前面加载，好让皮肤的 prompt 行保留下来。有一处默认值和上游不同：用量条默认关闭，`/skin band on` 打开。

上游：[hellosverre/claude-skins](https://github.com/hellosverre/claude-skins)（MIT）。

## 2. cc-band-pro

![cc-band-pro](docs/cc-band-pro-idle.png)
![cc-band-pro 运行中](docs/cc-band-pro-runing.png)

输入框上方的 powerline 横幅，锁定 Catppuccin Mocha。六个块——思考（终端支持图片时是螃蟹，否则是 Claude 图标）、模型、diff 数量、文件树、书签和上下文用量。每个块点一下就会在回合中立刻打开对应插件的面板，不往对话里留一行字。横幅本身很薄：面板属于 find-model、filetree、session-meter、after 和 transcript-bookmarks，它们被声明为依赖。

作者：[Linxuan](https://github.com/linxuan-sys)。本站原创。

## 3. cc-dsh-like

![cc-dsh-like](docs/cc-dsh-like.png)

dsh-TUI 风格的起始页：每个新会话顶部会出现 Claude-girl 立绘（点她会撒娇）、`CLAUDE` / `CODE` 点阵字、一行可点击切换的格言，以及一个技能下拉框，可以运行 `~/.claude/skills` 或项目 `.claude/skills` 里的任意技能。每个会话只插入一次，随后跟着对话一起向上滚动。

作者：[Linxuan](https://github.com/linxuan-sys)。本站原创。

## 4. sidebar-clear

![sidebar-clear](docs/sidebar-clear.png)

让插件侧栏变透明。Claude Code 会给停靠面板的四周刷上主题的 `composerSidebarBackground`；这个插件给没有指定背景的面板填上 `transparent`，于是终端自己的背景和透明度能透出来。`settings` 和 `changes` 会跳过，因为对话框在主题底色上更好读。

作者：[Linxuan](https://github.com/linxuan-sys)。本站原创。

## 5. paste-preview

![paste-preview](docs/paste-preview.png)

让你看见粘贴的图片，而不只是一个 `[Image #N]` 占位符：提示框上方显示缩略图，已发送的消息下面也显示，并标注编号。本 fork 里编辑器不再在粘贴时自动弹出——只有点缩略图下面的 **Edit** 才打开——缩略图接在 skins 画的那一行下面。它依赖 skins 先加载，这样才能读到被皮肤清空的原始 `[Image #N]` 文本。

fork 自 [alan890104/claude-code-paste-preview](https://github.com/alan890104/claude-code-paste-preview)（MIT）。

## 6. filetree

![filetree](docs/filetree.png)

停靠在对话旁边的 IDE 风格文件树：git 状态、文件预览，Claude 读取、写入和提交的文件会实时闪烁；支持搜索、键盘导航和分栏预览。本 fork 使用 Catppuccin 紫作为强调色，并且默认不打开面板，用 `/filetree` 打开。

fork 自 [data-goblin/claude-code-filetree](https://github.com/data-goblin/claude-code-filetree)（MIT）。

## 7. find-model

![find-model](docs/find-model.png)

侧栏模型选择器：`/find-model` 打开和 `/model` 相同的列表（读自合并后的设置），可按 id、label 或名称搜索，点击、Enter 或 `j`/`k` 切换。列表下方是 effort 等级，选中即对当前会话执行 `/effort`。

作者：[Linxuan](https://github.com/linxuan-sys)。本站原创。

## 8. session-meter

![session-meter](docs/session-meter.png)

一个展示会话自身数据的面板：按类别拆分的上下文窗口、带 pace 的用量限额、工具调用和模型请求。它还能在接近阈值时给模型发一次性提示、建议或执行 `/compact`，并保留一小段历史。这里 `autoOpen` 默认关闭，用 `/ctx` 打开。

fork 自 [arasovic/claude-code-mods — session-meter](https://github.com/arasovic/claude-code-mods/tree/main/session-meter)（MIT）。

## 9. after

![after](docs/after.png)

真正的提示词队列：`/after <task>` 把任务排到当前任务结束之后执行，不会干扰 Claude 正在做的事。队列显示在输入框上方的横幅里，也能在面板中编辑，还支持自然语言（比如 `/after remove the tests one`）。不需要 Node.js，也没有后台进程——mod 就住在 Claude Code 里。

fork 自 [midudev/better-claude](https://github.com/midudev/better-claude)（MIT）。

## 10. transcript-bookmarks

![transcript-bookmarks](docs/transcript-bookmarks.png)

收藏一条消息或一段选中的文字，之后从侧栏跳回去；书签随会话保存，恢复会话时还在。本 fork 让 📌 常驻在每条消息旁，并让每条书签通过 skins 的 Markdown 渲染器显示，skins 关闭时回退为纯文本。它依赖 skins，以便排在皮肤的整行钩子之前加载。

fork 自 [arcadeJHS/claude-code-mods — transcript-bookmarks](https://github.com/arcadeJHS/claude-code-mods/tree/main/transcript-bookmarks)（WTFPL）。

## 11. redgreen

![redgreen](docs/redgreen.png)

Claude 跑测试时，失败会落到对话旁边的面板里：失败测试的列表、选中那条的完整断言与 diff，以及之前的运行记录。它认识 vitest、jest、pytest、cargo、go、bun、deno 以及常见的 npm/pnpm/yarn 包装命令；全绿时只更新状态栏，不弹面板。

上游：[hellosverre/redgreen](https://github.com/hellosverre/redgreen)（MIT）。

## 12. smart-compact

![smart-compact](docs/smart-compact.png)

在合适的时机建议压缩，而不是等上下文真的塞满：提交或测试全绿之后、提示词缓存过期之前，或者 Claude 自己表示前一段工作已经结束时。输入框上方会弹出对话框，写明摘要必须保留什么；你按 Compact 才执行。

上游：[hellosverre/smart-compact](https://github.com/hellosverre/smart-compact)（MIT）。

## 13. mod-store

![mod-store](docs/mod-store.png)

一个 Claude Code mod 应用商店：`/mods` 浏览和搜索约 2,700 个社区 mod，安装前能看到每个 mod 能访问什么，一键安装。Claude 可以帮你搜索和比较 mod，但永远不能替你安装。

上游：[hellosverre/mod-store](https://github.com/hellosverre/mod-store)（MIT）。

## 安装

先添加商店：

```sh
claude plugin marketplace add linxuan-sys/cc-skin-pro
```

然后安装插件：

```sh
claude plugin install skins@cc-skin-pro
claude plugin install cc-band-pro@cc-skin-pro
claude plugin install cc-dsh-like@cc-skin-pro
claude plugin install sidebar-clear@cc-skin-pro
claude plugin install paste-preview@cc-skin-pro
claude plugin install filetree@cc-skin-pro
claude plugin install find-model@cc-skin-pro
claude plugin install session-meter@cc-skin-pro
claude plugin install after@cc-skin-pro
claude plugin install transcript-bookmarks@cc-skin-pro
claude plugin install redgreen@cc-skin-pro
claude plugin install smart-compact@cc-skin-pro
claude plugin install mod-store@cc-skin-pro
```

装完跑 `/reload-plugins`，或者重启 Claude Code。skins 放在第一条，因为 transcript-bookmarks 和 paste-preview 依赖它；cc-band-pro 声明了五个伙伴插件作为依赖，装它会一并装上。

建议 Claude Code 2.1.306 或更新——filetree 需要它，smart-compact 需要 2.1.295，redgreen 需要 2.1.293，skins 需要 2.1.287。

## 致谢

这个商店站在上游作者们的肩膀上，感谢：

- [hellosverre](https://github.com/hellosverre)——skins、redgreen、smart-compact、mod-store；
- [Kurt Buhler](https://github.com/data-goblin)——claude-code-filetree；
- [Mehmet Aras](https://github.com/arasovic)——session-meter；
- [Miguel Ángel Durán](https://github.com/midudev)——better-claude（after）；
- [Matteo Piazza](https://github.com/arcadeJHS)——transcript-bookmarks；
- [alan890104](https://github.com/alan890104)——paste-preview。

每个插件保留上游给的许可证：除 transcript-bookmarks（WTFPL）外均为 MIT。商店本身是 MIT，见 [LICENSE](LICENSE)。
