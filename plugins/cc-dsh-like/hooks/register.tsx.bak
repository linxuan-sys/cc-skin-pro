/**
 * cc-dsh-like · session-start portrait + CLAUDE/CODE wordmark + Skills banner.
 *
 * `session.start` places one transcript row (`$.ui.place`) that scrolls away
 * with the messages. Fresh sessions only; `--resume` is skipped.
 *
 * Knobs:
 *   - Portrait size — WANT_COLUMNS
 *   - Cute-look (撒娇) duration — CUTE_MS
 *   - Clawd-before-picture wait — REVEAL_MS
 *   - Wide wordmark — BIG_TOP_ROWS / BIG_BOTTOM_ROWS
 *   - Narrow wordmark — NARROW_TOP_ROWS / NARROW_BOTTOM_ROWS
 *   - Wordmark colors — BIG_FROM / BIG_MID / BIG_TO
 *   - Taglines — LOVE_TEXTS (click to cycle)
 *   - Images — swap the PNGs in assets/
 *   - No-graphics fallback — CLAWD_ROWS (drawn when the engine cannot show images)
 */
import type { Register } from 'claude-code'

const ROW_ID = 'cc-dsh-like'

/** Source art is 935×1017 px and cells are 8×16, so this many rows per width column. */
const ROWS_PER_COLUMN = (1017 / 935) / 2

const WANT_COLUMNS = 30

const CUTE_MS = 2200

/** Show Clawd first, then the picture — the wait also lands past the engine's first wipe. */
const REVEAL_MS = 1000
/** Clawd blinks twice mid-wait — close, open, close, open — before the handoff. */
const BLINK_AT_MS: readonly number[] = [350, 760]
const BLINK_MS = 160
/** One second after the picture lands, the cute look plays on its own. */
const AUTO_POKE_MS = 1000
/** Let the reveal land, then tap the screen so the engine resends every image. */
const ACTIVATE_MS = 120
/** One retry in case the first tap raced a repaint. */
const TAP_RETRY_MS = 600
/** One line per hook entry; read it after a view switch to see what the engine called. */
const TRACE_FILE = '/tmp/cc-dsh-like-events.log'

/** Wait for the first paint, then ask the engine whether the picture drew as pixels or alt. */
const PROBE_MS = 300
const PROBE_TRIES = 3

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
  ' █████   ██        ████    ██  ██   ██████   ██████',
  '██  ██   ██       ██  ██   ██  ██   ██  ██   ██',
  '██       ██       ██████   ██  ██   ██  ██   █████',
  '██  ██   ██       ██  ██   ██  ██   ██  ██   ██',
  ' █████   ██████   ██  ██    ████    ██████   ██████',
]

const BIG_BOTTOM_ROWS: readonly string[] = [
  ' █████    ████    ██████   ██████',
  '██  ██   ██  ██   ██  ██   ██',
  '██       ██  ██   ██  ██   █████',
  '██  ██   ██  ██   ██  ██   ██',
  ' █████    ████    ██████   ██████',
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
  '██  ██   ██████   ██████',
  '██  ██   ██  ██   ██    ',
  '██  ██   ██  ██   █████ ',
  '██  ██   ██  ██   ██    ',
  ' ████    ██████   ██████',
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
/** False until REVEAL_MS: the row shows Clawd so no picture is drawn into the engine's first wipe. */
let imageReady = false
/** True for BLINK_MS: the fallback draws the shut-eye frame. */
let clawdBlink = false

/** Set in session.start from the tmux veto; the engine's blit verdict can still demote it. */
let hasGraphics = true
/** One engine probe per process: did the picture really draw as pixels, or as its alt? */
let probeState: 'idle' | 'pending' | 'done' = 'idle'
/** Latest mounted picture site, read by the probe when it fires. */
let mountInfo: { requestId: string; columns: number; rows: number; file: string } | undefined
/** Debug trail, one line per hook entry, shown by reading TRACE_FILE. */
let trace = ''
let note: ((text: string) => void) | undefined

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    note = (text: string): void => {
      trace += `${new Date().toISOString()} ${text}\n`
      void $.fs.write(TRACE_FILE, trace).catch(() => {})
    }
    note('session.start')
    // Clawd first: the engine's first full repaint wipes a picture drawn too early. The
    // reveal after a second lands past that window; the probe's blit then sends the picture.
    imageReady = false
    probeState = 'idle'
    clawdBlink = false
    isCute = false
    // Blink twice while he waits: shut the eyes, open them, then again before the picture.
    let kittyWindow: string | undefined
    for (const at of BLINK_AT_MS) {
      $.clock.after(at, () => {
        clawdBlink = true
        $.ui.invalidate('ui.render')
        $.clock.after(BLINK_MS, () => {
          clawdBlink = false
          $.ui.invalidate('ui.render')
          note?.('blink end')
        })
      })
    }
    $.clock.after(REVEAL_MS, () => {
      note?.('reveal')
      imageReady = true
      $.ui.invalidate('ui.render')
      // A click is just bytes on stdin: kitty's remote control writes the focus toggle and
      // a real left press/release into this session, so the engine walks the exact same
      // terminal-focus path a hand click does — no alt-screen clear, pixels re-sent.
      $.clock.after(ACTIVATE_MS, () => {
        tap()
        $.clock.after(TAP_RETRY_MS, tap)
      })
      // One second after the picture lands, flip to the cute look — the state a hand
      // poke sets. The new source only reaches the terminal on a resend, so tap with
      // it; CUTE_MS later she is back to the normal picture.
      $.clock.after(AUTO_POKE_MS, () => {
        if (isCute) return
        note?.('cute')
        isCute = true
        $.ui.invalidate('ui.render')
        tap()
        $.clock.after(CUTE_MS, () => {
          isCute = false
          $.ui.invalidate('ui.render')
        })
      })
    })

    // Kitty unreachable (tmux, another terminal, a background host): the resume path still
    // resends, just with the alt-screen clear that makes it a coin toss.
    const resend = (): void => {
      note?.('sigcont')
      try {
        process.kill(process.pid, 'SIGCONT')
      } catch {
        // No signals here; the picture will need a real click.
      }
    }
    const tap = (): void => {
      // No picture drawn: a tap would only inject clicks into whatever hosts us.
      if (!hasGraphics) return
      note?.('tap')
      // No window id (a launcher or a nested host drops it): the focused kitty window
      // is the one this session is in at tap time.
      const target = kittyWindow === undefined ? 'state:focused' : `id:${kittyWindow}`
      try {
        void $.process.run([
          'kitten', '@', 'send-text', '--match', target,
          '\\e[O\\e[I\\e[<0;1;1M\\e[<0;1;1m',
        ]).then(
          ({ exitCode }) => {
            if (exitCode !== 0) resend()
          },
          () => resend(),
        )
      } catch {
        resend()
      }
    }

    // Read once per session so ui.render stays synchronous. tmux and an editor's
    // :terminal inherit the outer kitty's env while the graphics escapes never pass
    // through: tmux, nvim ($NVIM), vim ($VIM_TERMINAL). Everywhere else the engine has
    // the last word — see the blit probe in ui.render.
    const tmux = await $.env.get('TMUX')
    const nvim = await $.env.get('NVIM')
    const vimTerminal = await $.env.get('VIM_TERMINAL')
    hasGraphics = tmux === undefined && nvim === undefined && vimTerminal === undefined
    kittyWindow = await $.env.get('KITTY_WINDOW_ID')

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
    if (!placed.isPlaced) $.ui.log(`cc-dsh-like: ${placed.reason}`, { to: 'debug' })
    return started
  })

  on('ui.render', { component: 'Placed' }, async ($, e, next) => {
    if (e.props.plugin !== $.plugin.name || e.props.id !== ROW_ID) return next(e)
    if (e.surface !== 'terminal') return next(e)

    const { Box, Client, Image, Text } = $.ui.resolve(e)
    // A replay after a view switch runs without the session.start state (no sniff, no paths).
    // Bail then: drawing Clawd here would overwrite the engine's image slot with text,
    // and the portrait could never come back. Bailing keeps the click-to-restore alive.
    if (normalFile === undefined || cuteFile === undefined) return next(e)
    const useImage = hasGraphics && imageReady
    const columns0 = e.viewport?.columns ?? FALLBACK_COLUMNS
    const rows0 = e.viewport?.rows ?? FALLBACK_ROWS
    note?.(`render ready=${imageReady} image=${useImage} vp=${columns0}x${rows0} id=${e.requestId}`)

    // Fit the desired width first; if the height overflows, shrink the width instead.
    let columns = Math.min(WANT_COLUMNS, Math.max(1, columns0 - 4))
    let rows = Math.max(1, Math.round(columns * ROWS_PER_COLUMN))
    const maxRows = Math.max(1, rows0 - 8)
    if (rows > maxRows) {
      rows = maxRows
      columns = Math.max(1, Math.min(columns0, Math.round(rows / ROWS_PER_COLUMN)))
    }

    // Keep the latest picture site for the probe below.
    mountInfo = useImage
      ? { requestId: e.requestId, columns, rows, file: isCute ? cuteFile : normalFile }
      : undefined

    // The engine draws the picture where the terminal can and the alt elsewhere. A refusal
    // whose reason names the alt proves it — demote then. Any other refusal (not mounted
    // yet, a repaint in flight) is retried, never demoted.
    if (useImage && probeState === 'idle') {
      probeState = 'pending'
      let attempt = 0
      const probe = async (): Promise<void> => {
        const mount = mountInfo
        if (mount === undefined) {
          probeState = 'done'
          return
        }
        try {
          const { deny } = await $.ui.blit({
            requestId: mount.requestId,
            key: 'claude-girl',
            source: { file: mount.file, format: 'png' },
            columns: mount.columns,
            rows: mount.rows,
          })
          if (deny === undefined) {
            probeState = 'done'
            return
          }
          if (/alt/i.test(deny)) {
            probeState = 'done'
            hasGraphics = false
            $.ui.invalidate('ui.render')
            return
          }
        } catch {
          probeState = 'done'
          return
        }
        attempt += 1
        probeState = attempt >= PROBE_TRIES ? 'idle' : 'pending'
        if (probeState === 'pending') $.clock.after(PROBE_MS, () => void probe())
      }
      $.clock.after(PROBE_MS, () => void probe())
    }

    const portrait = useImage ? (
      <Box key="claude-girl-column" flexDirection="column" alignItems="center" flexShrink={0}>
        <Box key="claude-girl-stack" width={columns} height={rows}>
          <Image
            key="claude-girl"
            source={{ file: isCute ? cuteFile : normalFile, format: 'png' }}
            columns={columns}
            rows={rows}
            alt="Claude girl"
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
