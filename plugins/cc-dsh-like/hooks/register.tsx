/**
 * cc-dsh-like · session-start portrait + CLAUDE/CODE wordmark + Skills banner.
 *
 * `session.start` places one transcript row (`$.ui.place`) that scrolls away
 * with the messages. Fresh sessions only; `--resume` is skipped.
 *
 * Knobs:
 *   - Portrait size — WANT_COLUMNS
 *   - Cute-look (撒娇) duration — CUTE_MS
 *   - Clawd-before-picture wait — BLINK_AT_MS / AFTER_LAST_BLINK_MS
 *   - Wide wordmark — BIG_TOP_ROWS / BIG_BOTTOM_ROWS
 *   - Narrow wordmark — NARROW_TOP_ROWS / NARROW_BOTTOM_ROWS
 *   - Wordmark colors — BIG_FROM / BIG_MID / BIG_TO
 *   - Taglines — LOVE_TEXTS (click to cycle)
 *   - Images — swap the PNGs in assets/
 *   - Pre-reveal placeholder — CLAWD_ROWS (blinks until the picture lands)
 */
import type { Register } from 'claude-code'

const ROW_ID = 'cc-dsh-like'

/** Source art is 935×1017 px and cells are 8×16, so this many rows per width column. */
const ROWS_PER_COLUMN = (1017 / 935) / 2

const WANT_COLUMNS = 30

const CUTE_MS = 2200

/** Show Clawd first, then the picture. */
const BLINK_AT_MS: readonly number[] = [1400, 2200]
/** The reveal grows from the last blink's end: blink over → picture at once. */
const AFTER_LAST_BLINK_MS = 0
const BLINK_MS = 200
/** One second after the picture lands, the cute look plays on its own. */
const AUTO_POKE_MS = 1000

const POKE_KEY = 'poke'
const SKILLS_KEY = 'skills'
const LOVE_KEY = 'love'

/** Official quadrant Clawd, scaled 3x to fill the portrait frame. */
const CLAWD_ROWS: readonly string[] = [
  '    ▐█████████████████▌    ',
  '    ▐██▛▀█████████▀▜██▌    ',
  '    ▐██▌ █████████ ▐██▌    ',
  ' ▐███████████████████████▌ ',
  ' ▝▀▀▜█████████████████▛▀▀▘ ',
  '    ▐█████████████████▌    ',
  '      █▌ █▌     ▐█ ▐█      ',
  '      ▀▘ ▀▘     ▝▀ ▝▀      ',
]
/** The same Clawd mid-blink: the eye holes fill in, leaving two thin dark slits. */
const CLAWD_BLINK_ROWS: readonly string[] = [
  '    ▐█████████████████▌    ',
  '    ▐██▄▄█████████▄▄██▌    ',
  '    ▐█████████████████▌    ',
  ' ▐███████████████████████▌ ',
  ' ▝▀▀▜█████████████████▛▀▀▘ ',
  '    ▐█████████████████▌    ',
  '      █▌ █▌     ▐█ ▐█      ',
  '      ▀▘ ▀▘     ▝▀ ▝▀      ',
]
const CLAWD_COLOR = '#d97757'

const FALLBACK_COLUMNS = 80
const FALLBACK_ROWS = 24

const LOVE_TEXTS: readonly string[] = [
  'All you need is love.',
  'I do the clever bits, you do the cute bits — deal?',
  'Smarts are mine, charm is yours.',
  'Logic to me, whimsy to you.',
  'I carry the complexity; you carry the joy.',
  'Hard work handled, sweetness crafted by you.',
  'Brains here, sparkle there.',
  'Let me tackle the tough, you own the soft.',
  'Complexity’s my lane, cuteness is yours.',
  'I weave the skill, you bring the warmth.',
  'Heavy thinking for me, light magic for you.',
  'Leave the hard parts to me, keep the cute to you.',
  'Precision’s my thing, delight’s yours.',
  'Grind the clever, bloom the lovely.',
]

/** Top row `CLAUDE`; bottom row `CODE`, left-aligned with the top. */
const BIG_TOP_ROWS: readonly string[] = [
  ' █████   ██        ████    ██  ██   █████    ██████',
  '██  ██   ██       ██  ██   ██  ██   ██  ██   ██',
  '██       ██       ██████   ██  ██   ██  ██   █████',
  '██  ██   ██       ██  ██   ██  ██   ██  ██   ██',
  ' █████   ██████   ██  ██    ████    █████    ██████',
]

const BIG_BOTTOM_ROWS: readonly string[] = [
  ' █████    ████    █████    ██████',
  '██  ██   ██  ██   ██  ██   ██',
  '██       ██  ██   ██  ██   █████',
  '██  ██   ██  ██   ██  ██   ██',
  ' █████    ████    █████    ██████',
]

const BIG_COLUMNS = 51

/** Narrow variant: CLA / UDE, the CODE row is dropped. */
const NARROW_TOP_ROWS: readonly string[] = [
  ' █████   ██        ████ ',
  '██  ██   ██       ██  ██',
  '██       ██       ██████',
  '██  ██   ██       ██  ██',
  ' █████   ██████   ██  ██',
]

const NARROW_BOTTOM_ROWS: readonly string[] = [
  '██  ██   █████    ██████',
  '██  ██   ██  ██   ██    ',
  '██  ██   ██  ██   █████ ',
  '██  ██   ██  ██   ██    ',
  ' ████    █████    ██████',
]

const NARROW_COLUMNS = 24
const NARROW_TOP_WIDTH = 27
const NARROW_BOTTOM_WIDTH = 27

/** Three orange stops: top row FROM→MID, bottom row MID→TO. */
const BIG_FROM = '#e68a69'
const BIG_MID = '#efa97e'
const BIG_TO = '#fbd6b0'

/** Gradient denominators, including the trailing gap column. */
const BIG_TOP_WIDTH = 54
const BIG_BOTTOM_WIDTH = 36

/** Per-column colors would need dozens of Texts; quantize to this many shades instead. */
const BIG_STEPS = 8

interface Run {
  text: string
  color?: string
}

const mix = (from: string, to: string, t: number): string => {
  const channel = (hex: string, shift: number): number => parseInt(hex.slice(1, 7), 16) >> shift & 0xff
  const blend = (shift: number): string => {
    const a = channel(from, shift)
    const b = channel(to, shift)
    return Math.round(a + (b - a) * t).toString(16).padStart(2, '0')
  }
  return `#${blend(16)}${blend(8)}${blend(0)}`
}

/** Color one wordmark row per column, merged into same-color runs. */
const colorRow = (row: string, width: number, from: string, to: string): Run[] => {
  const runs: Run[] = []
  let column = 0
  for (const ch of row) {
    const t = width <= 1 ? 0 : column / (width - 1)
    const step = Math.round(t * (BIG_STEPS - 1)) / (BIG_STEPS - 1)
    const color = ch === ' ' ? undefined : mix(from, to, step)
    const last = runs[runs.length - 1]
    if (last !== undefined && last.color === color) last.text += ch
    else runs.push({ text: ch, color })
    column += 1
  }
  return runs
}

let normalFile: string | undefined
let cuteFile: string | undefined
let isCute = false
let skillNames: readonly string[] = []
/** False until the reveal: the row shows Clawd until then. */
let imageReady = false
/** False outside kitty/Ghostty and in tmux/editor terminals: the row keeps Clawd. */
let hasGraphics = true
/** True for BLINK_MS: the fallback draws the shut-eye frame. */
let clawdBlink = false
/** Bumped per session.start: timers of an earlier session (a view-switch replay)
 * check it and retire, so they cannot flip state under the new one. */
let epoch = 0

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const tmux = await $.env.get('TMUX')
    const nvim = await $.env.get('NVIM')
    const vimTerminal = await $.env.get('VIM_TERMINAL')
    const term = await $.env.get('TERM')
    const termProgram = await $.env.get('TERM_PROGRAM')
    const kittyOrGhostty =
      term === 'xterm-kitty' ||
      term === 'xterm-ghostty' ||
      termProgram === 'kitty' ||
      termProgram === 'ghostty'
    hasGraphics = tmux === undefined && nvim === undefined && vimTerminal === undefined && kittyOrGhostty
    epoch += 1
    const mine = epoch
    imageReady = false
    clawdBlink = false
    isCute = false
    // Blink and the reveal are one causal chain: the last blink's end callback grows
    // the reveal, so whenever the eyes blinked the picture must follow.
    const reveal = (): void => {
      if (mine !== epoch) return
      imageReady = true
      $.ui.invalidate('ui.render')
      // One second after the picture lands, flip to the cute look — the state a hand
      // poke sets. CUTE_MS later she is back to the normal picture.
      $.clock.after(AUTO_POKE_MS, () => {
        if (mine !== epoch || isCute) return
        isCute = true
        $.ui.invalidate('ui.render')
        $.clock.after(CUTE_MS, () => {
          if (mine !== epoch) return
          isCute = false
          $.ui.invalidate('ui.render')
        })
      })
    }
    // Blinks are scheduled once the row is placed, below: an -p or --resume run
    // places nothing and must not fire a reveal into thin air.

    for (const base of [$.plugin.root, `${$.plugin.root}/..`]) {
      const normal = `${base}/assets/claude-girl.png`
      const cute = `${base}/assets/claude-girl-cute.png`
      if ((await $.fs.exists(normal)) && (await $.fs.exists(cute))) {
        normalFile = normal
        cuteFile = cute
        break
      }
    }
    if (normalFile === undefined) {
      $.ui.log('cc-dsh-like: assets/claude-girl.png not found', { to: 'debug' })
    }

    const started = await next(e)
    // -p / SDK hosts have no surface, and an already-chatted session gets no mid-history insert.
    if (e.surface === null) return started
    if ((await $.session.turns()) > 0) return started

    try {
      const usage = await $.session.usage({ breakdown: 'summary' })
      const skills = usage.context.breakdown?.skills?.skillFrontmatter ?? []
      skillNames = skills.map(skill => skill.name)
    } catch {
      skillNames = []
    }

    const placed = await $.ui.place({ id: ROW_ID })
    if (!placed.isPlaced) {
      $.ui.log(`cc-dsh-like: ${placed.reason}`, { to: 'debug' })
      return started
    }
    // The row is in the transcript: blink twice, then the picture.
    let blinksDone = 0
    for (const at of BLINK_AT_MS) {
      $.clock.after(at, () => {
        if (mine !== epoch) return
        clawdBlink = true
        $.ui.invalidate('ui.render')
        $.clock.after(BLINK_MS, () => {
          if (mine !== epoch) return
          clawdBlink = false
          $.ui.invalidate('ui.render')
          blinksDone += 1
          if (blinksDone === BLINK_AT_MS.length) $.clock.after(AFTER_LAST_BLINK_MS, reveal)
        })
      })
    }
    return started
  })

  on('ui.render', { component: 'Placed' }, async ($, e, next) => {
    if (e.props.plugin !== $.plugin.name || e.props.id !== ROW_ID) return next(e)
    if (e.surface !== 'terminal') return next(e)

    const { Box, Client, Image, Text } = $.ui.resolve(e)
    // A replay after a view switch runs without the session.start state (no paths).
    // Bail then: drawing Clawd here would overwrite the engine's image slot with text.
    if (normalFile === undefined || cuteFile === undefined) return next(e)
    const columns0 = e.viewport?.columns ?? FALLBACK_COLUMNS
    const rows0 = e.viewport?.rows ?? FALLBACK_ROWS

    // Fit the desired width first; if the height overflows, shrink the width instead.
    let columns = Math.min(WANT_COLUMNS, Math.max(1, columns0 - 4))
    let rows = Math.max(1, Math.round(columns * ROWS_PER_COLUMN))
    const maxRows = Math.max(1, rows0 - 8)
    if (rows > maxRows) {
      rows = maxRows
      columns = Math.max(1, Math.min(columns0, Math.round(rows / ROWS_PER_COLUMN)))
    }

    const portrait = imageReady && hasGraphics ? (
      <Box key="claude-girl-column" flexDirection="column" alignItems="center" flexShrink={0}>
        <Box key="claude-girl-stack" width={columns} height={rows}>
          <Image
            key="claude-girl"
            source={{ file: isCute ? cuteFile as string : normalFile as string, format: 'png' }}
            columns={columns}
            rows={rows}
            alt=" "
          />
          <Box key="poke-layer" position="absolute" top={0} left={0}>
            <Client key={POKE_KEY} module="./poke.tsx" width={columns} height={rows} />
          </Box>
        </Box>
      </Box>
    ) : (
      // Same footprint as the picture: the row's height and width must not change when the
      // portrait swaps in, or the wordmark and the lines below shift.
      <Box
        key="clawd-fallback"
        width={columns}
        height={rows}
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        flexShrink={0}
      >
        {(clawdBlink ? CLAWD_BLINK_ROWS : CLAWD_ROWS).map((row, index) => (
          <Text key={`clawd-${index}`} color={CLAWD_COLOR}>
            {row}
          </Text>
        ))}
        <Box key="clawd-poke-layer" position="absolute" top={0} left={0}>
          <Client key={POKE_KEY} module="./poke.tsx" width={columns} height={rows} />
        </Box>
      </Box>
    )

    // Wide layout when it fits, narrow variant on half width, portrait only below that.
    const room = columns0 - 4 - columns - 2
    const titleRows =
      room >= BIG_COLUMNS
        ? {
            columns: BIG_COLUMNS,
            top: BIG_TOP_ROWS,
            bottom: BIG_BOTTOM_ROWS,
            topWidth: BIG_TOP_WIDTH,
            bottomWidth: BIG_BOTTOM_WIDTH,
          }
        : room >= NARROW_COLUMNS
          ? {
              columns: NARROW_COLUMNS,
              top: NARROW_TOP_ROWS,
              bottom: NARROW_BOTTOM_ROWS,
              topWidth: NARROW_TOP_WIDTH,
              bottomWidth: NARROW_BOTTOM_WIDTH,
            }
          : undefined

    // Banner width is independent of the wordmark: it stays even when the wordmark is gone.
    const bandWidth = Math.max(
      20,
      Math.min(columns0 - 4, titleRows === undefined ? columns0 - 4 : columns + 2 + titleRows.columns),
    )

    // The longest tagline can exceed the banner; give it its own width so it is not truncated.
    const loveWidth = Math.max(
      bandWidth,
      Math.min(columns0 - 4, Math.max(...LOVE_TEXTS.map(text => text.length))),
    )

    const title = titleRows === undefined
      ? undefined
      : (
        <Box key="claude-girl-title" flexDirection="column" flexShrink={0}>
          {titleRows.top.map((row, index) => (
            <Text key={`big-top-${index}`} wrap="truncate-end">
              {colorRow(row, titleRows.topWidth, BIG_FROM, BIG_MID).map((run, runIndex) => (
                <Text key={`run-${runIndex}`} color={run.color}>
                  {run.text}
                </Text>
              ))}
            </Text>
          ))}
          <Box key="big-gap" height={1} />
          {titleRows.bottom.map((row, index) => (
            <Text key={`big-bottom-${index}`} wrap="truncate-end">
              {colorRow(row, titleRows.bottomWidth, BIG_MID, BIG_TO).map((run, runIndex) => (
                <Text key={`run-${runIndex}`} color={run.color}>
                  {run.text}
                </Text>
              ))}
            </Text>
          ))}
        </Box>
      )

    return (
      <Box key="cc-dsh-like-band" flexDirection="column" alignItems="center">
        {title === undefined ? (
          portrait
        ) : (
          <Box key="claude-girl-row" flexDirection="row" alignItems="center" gap={2}>
            {portrait}
            {title}
          </Box>
        )}
        {/* Both portraits keep the same footprint, so the tagline never moves on the swap. */}
        <Box key="love-line" marginTop={-1} width={loveWidth}>
          <Client
            key={LOVE_KEY}
            module="./love.tsx"
            props={{ texts: LOVE_TEXTS, width: loveWidth }}
            width={loveWidth}
            height={1}
          />
        </Box>
        <Box key="skills-line" marginTop={1} width={bandWidth}>
          <Client
            key={SKILLS_KEY}
            module="./skills.tsx"
            props={{ skills: skillNames, width: bandWidth }}
            width={bandWidth}
          />
        </Box>
      </Box>
    )
  })

  on('ui.message', async ($, e, next) => {
    if (e.element === SKILLS_KEY) {
      const picked = (e.data as { pick?: unknown } | undefined)?.pick
      if (typeof picked !== 'string' || picked === '') return next(e)
      try {
        await $.command.run({ command: picked })
      } catch (error) {
        $.ui.log(`cc-dsh-like: failed to send ${picked} — ${String(error)}`, { to: 'debug' })
      }
      return next(e)
    }

    if (e.element !== POKE_KEY) return next(e)

    const data = e.data as { poke?: unknown } | undefined
    if (data === undefined || data === null || data.poke !== true) return next(e)

    if (!imageReady || !hasGraphics) {
      if (clawdBlink) return next(e)
      clawdBlink = true
      $.ui.invalidate('ui.render')
      const mine = epoch
      $.clock.after(BLINK_MS, () => {
        if (mine !== epoch) return
        clawdBlink = false
        $.ui.invalidate('ui.render')
      })
      return next(e)
    }

    if (isCute) return next(e)

    isCute = true
    $.ui.invalidate('ui.render')
    $.clock.after(CUTE_MS, () => {
      isCute = false
      $.ui.invalidate('ui.render')
    })
    return next(e)
  })
}
