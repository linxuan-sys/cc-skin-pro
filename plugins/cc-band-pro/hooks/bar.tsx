import type { BoxProps, ButtonProps, ElementConstructor, TextProps } from 'claude-code'

import type { Usage } from '../types'

/** One block's colors: its background and the text drawn on it. */
type Paint = { bg: string; fg: string }

/**
 * Catppuccin Mocha, as cc-skin-pro's skin of that name paints its bar: a
 * gradient, left to right, one step per block. Locked: no themes to pick.
 */
const BLOCKS: readonly Paint[] = [
  { bg: '#f2e9fd', fg: '#11111b' }, // pale lavender: the thinking block
  { bg: '#89dceb', fg: '#11111b' }, // sky: usage until a reading
  { bg: '#74c7ec', fg: '#11111b' }, // sapphire: diff
  { bg: '#89b4fa', fg: '#11111b' }, // blue: tree
  { bg: '#b4befe', fg: '#11111b' }, // lavender: bookmarks
  { bg: '#cba6f7', fg: '#11111b' }, // mauve: pi, the gradient's end
]
/** The shade the thinking block pulses to while Claude works (pink). */
const PULSE = '#f5c2e7'
/**
 * The usage block's colors as the context fills: green to 30 %, yellow to 60 %,
 * orange to 80 %, red past it — each a Mocha tone, dark text on all.
 */
const CALM: Paint = { bg: '#a6e3a1', fg: '#11111b' } // green
const WARN: Paint = { bg: '#f9e2af', fg: '#11111b' } // yellow
const ORANGE: Paint = { bg: '#fab387', fg: '#11111b' } // peach
const DANGER: Paint = { bg: '#f38ba8', fg: '#11111b' } // red

/** Powerline separators (Nerd Fonts): a round cap to open, an arrow between blocks, a round cap to close. */
const POWERLINE = { open: '\ue0b6', arrow: '\ue0b0', close: '\ue0b4' }

/** Nerd Font icons, at code points every Nerd Font shares. */
const ICONS = { claude: '\uec82', diff: '\uf440', tree: '\uf07b', bookmark: '\uf02e', context: '\uf1c0', pi: '\u{F06A9}' } as const

/** The ASCII words a button's label uses for the icons: a label takes no Nerd Font glyphs. */
const ICON_WORDS: Readonly<Record<string, string>> = { [ICONS.diff]: '±', [ICONS.context]: 'ctx', [ICONS.pi]: 'pi' }

/** The spinner while a turn runs, and how often it moves. */
const FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
export const FRAME_MS = 150

/** The small meter in the usage block: ●●○○○. */
const METER = { width: 5, fill: '●', empty: '○' }

/** How many times coarser the bar can get; the richest that fits is drawn. */
const MAX_LEVEL = 2

/** What a press on a block runs; the thinking block's opens the After queue. */
export type BarPress = 'after' | 'diff' | 'tree' | 'mark' | 'usage' | 'pi'

type Pill = {
  key: string
  text: string
  paint: Paint
  press: BarPress
}

/** A block as barPills builds it, before the Mocha step gives it its paint. */
type Block = Omit<Pill, 'paint'> & { alert?: Paint }

type BarInput = {
  usage: Usage
  /** How many file edits the last turn made. */
  diffCount: number
  isWorking: boolean
  /** Advances while a turn runs: the spinner and the pulse read it. */
  frame: number
}

/** `850`, `8.4k`, `213k`, `1.2M`. */
const formatTokens = (tokens: number): string => {
  if (tokens < 1000) {
    return String(tokens)
  }
  if (tokens < 1_000_000) {
    return tokens < 10_000 ? `${(tokens / 1000).toFixed(1)}k` : `${Math.round(tokens / 1000)}k`
  }

  return `${(tokens / 1_000_000).toFixed(1)}M`
}

/** A meter of five cells, `percent` of them filled (at least one once above 0). */
const meter = (percent: number): string => {
  const clamped = Math.min(100, Math.max(0, percent))
  const filled = clamped > 0 ? Math.max(1, Math.round((clamped / 100) * METER.width)) : 0

  return METER.fill.repeat(filled) + METER.empty.repeat(METER.width - filled)
}

/** The usage block's paint as the context fills; `undefined` (the gray) before the first reading. */
const alertFor = (percent: number | null): Paint | undefined =>
  percent === null ? undefined : percent >= 80 ? DANGER : percent >= 60 ? ORANGE : percent >= 30 ? WARN : CALM

/** Code points a terminal draws two cells wide: East Asian wide and fullwidth forms, emoji. */
const WIDE: readonly (readonly [number, number])[] = [
  [0x1100, 0x115f], [0x2e80, 0x303e], [0x3041, 0x33ff], [0x3400, 0x4dbf], [0x4e00, 0x9fff], [0xa000, 0xa4cf],
  [0xac00, 0xd7a3], [0xf900, 0xfaff], [0xfe30, 0xfe6f], [0xff00, 0xff60], [0xffe0, 0xffe6], [0x1f300, 0x1f64f],
  [0x1f680, 0x1f6ff], [0x1f900, 0x1f9ff], [0x20000, 0x3fffd],
]
const ZERO_WIDTH = /[\p{M}\p{Cf}]/u

const charCells = (char: string): number => {
  if (ZERO_WIDTH.test(char)) {
    return 0
  }
  const code = char.codePointAt(0) ?? 0

  return WIDE.some(([from, to]) => code >= from && code <= to) ? 2 : 1
}

/** Terminal cells, not code points: a wide character takes two, a combining mark none. */
const cells = (text: string): number => [...text].reduce((sum, char) => sum + charCells(char), 0)

/**
 * The six blocks at one level of detail: 0 is everything, and each level up
 * drops one thing, in this order: the usage block's token count, then its
 * meter. The blocks themselves never go: each is the way into its own pane.
 */
const barPills = (input: BarInput, level: number): Pill[] => {
  const { usage, isWorking, frame } = input
  const percent = usage.contextPercent
  const fill = level < 2 && percent !== null ? meter(percent) : ''
  const tokens = level < 1 && usage.contextTokens !== null ? `· ${formatTokens(usage.contextTokens)}` : ''
  const reading = [percent === null ? '–' : fill, tokens].filter(part => part !== '').join(' ')

  const blocks: Block[] = [
    { key: 'thinking', text: isWorking ? `${ICONS.claude} ${FRAMES[frame % FRAMES.length]}` : ICONS.claude, press: 'after' },
    {
      key: 'usage',
      text: reading === '' ? ICONS.context : `${ICONS.context} ${reading}`,
      alert: alertFor(percent),
      press: 'usage',
    },
    { key: 'diff', text: `${ICONS.diff} replay${input.diffCount > 0 ? ` ${input.diffCount}` : ''}`, press: 'diff' },
    { key: 'tree', text: `${ICONS.tree} tree`, press: 'tree' },
    { key: 'mark', text: `${ICONS.bookmark} marks`, press: 'mark' },
    { key: 'pi', text: `${ICONS.pi} pi`, press: 'pi' },
  ]
  const isPulsing = isWorking && Math.floor(frame / 4) % 2 === 1

  return blocks.map(({ alert, ...block }, index) => {
    const step = BLOCKS[index]!
    const paint = alert ?? (index === 0 && isPulsing ? { ...step, bg: PULSE } : step)

    return { ...block, paint }
  })
}

/** Cells the bar takes: each block padded by a space a side, plus the two caps and the arrows between. */
const barWidth = (pills: readonly Pill[]): number =>
  pills.reduce((sum, pill) => sum + cells(pill.text) + 2, 0) + pills.length + 1

/** The richest blocks that fit in `columns`; the coarsest when none does. */
export const fitPills = (input: BarInput, columns: number): Pill[] => {
  for (let level = 0; level < MAX_LEVEL; level++) {
    const pills = barPills(input, level)
    if (barWidth(pills) <= columns) {
      return pills
    }
  }

  return barPills(input, MAX_LEVEL)
}

/**
 * A block's text as a button's label: a button draws its label, not the colored
 * text inside it, and that label takes no private-use glyph. Icons become
 * words, any other private-use glyph goes, spaces collapse.
 */
const plainLabel = (text: string): string =>
  [...text]
    .map(char => ICON_WORDS[char] ?? (/[\ue000-\uf8ff]/u.test(char) ? '' : char))
    .join('')
    .replace(/\s+/g, ' ')
    .trim()

/** The elements the terminal's table carries; a block is pressable through `Button`. */
export type Elements = {
  Box: ElementConstructor<BoxProps>
  Text: ElementConstructor<TextProps>
  Button: ElementConstructor<ButtonProps>
}

/**
 * Draws the blocks as a powerline: a round cap, each block on its own
 * background, an arrow in the left block's color over the right one's, a
 * round cap to end. A block with a press is a button (a click, or Enter while
 * the band holds the focus).
 */
export const drawPowerline = (
  { Box, Text, Button }: Elements,
  pills: readonly Pill[],
  onPress: (press: BarPress) => void,
) => {
  return (
    <Box flexDirection="row" flexWrap="nowrap" overflow="hidden">
      <Text key="open" color={pills[0]!.paint.bg}>
        {POWERLINE.open}
      </Text>
      {pills.flatMap((pill, index) => {
        const following = pills[index + 1]
        return [
          <Button key={`${pill.key}-button`} label={plainLabel(pill.text) || pill.press} plain onPress={() => onPress(pill.press)}>
            <Text backgroundColor={pill.paint.bg} color={pill.paint.fg} bold>
              {` ${pill.text} `}
            </Text>
          </Button>,
          <Text key={`${pill.key}-edge`} color={pill.paint.bg} backgroundColor={following?.paint.bg}>
            {following === undefined ? POWERLINE.close : POWERLINE.arrow}
          </Text>,
        ]
      })}
    </Box>
  )
}
