import type { BoxProps, ButtonProps, ElementConstructor, ImageProps, TextProps } from 'claude-code'

import type { Usage } from '../types'

/** One block's colors: its background and the text drawn on it. */
export type Paint = { bg: string; fg: string }

/**
 * Catppuccin Mocha, as cc-skin-pro's skin of that name paints its bar: a
 * gradient, left to right, one step per block. Locked: no themes to pick.
 */
const BLOCKS: readonly Paint[] = [
  { bg: '#f2e9fd', fg: '#11111b' }, // pale lavender: the thinking block
  { bg: '#94e2d5', fg: '#11111b' }, // teal: the model
  { bg: '#b4befe', fg: '#11111b' }, // lavender: diff
  { bg: '#89b4fa', fg: '#11111b' }, // blue: tree
  { bg: '#585b70', fg: '#cdd6f4' }, // surface2: bookmarks
  { bg: '#313244', fg: '#cdd6f4' }, // surface0: usage
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
const ICONS = { claude: '\uec82', model: '\uf2db', diff: '\uf440', tree: '\uf07b', bookmark: '\uf02e', context: '\uf1c0' } as const

/**
 * The thinking block's pictures on terminals that draw one: the crab resting,
 * and the crab at its laptop while Claude works — each its own cell box, so
 * neither stretches. Elsewhere the block wears the Claude glyph instead.
 */
const CRAB_IMAGES = {
  idle: { columns: 3, rows: 1 },
  typing: { columns: 2, rows: 1 },
} as const

/** The icons as the words a button's label uses, where a surface draws labels (Desktop, VS Code). */
const ICON_WORDS: Readonly<Record<string, string>> = { [ICONS.diff]: '±', [ICONS.context]: 'ctx' }

/** The spinner beside the crab while a turn runs, and how often it moves. */
const FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
export const FRAME_MS = 150

/** The small meter in the usage block: ●●○○○. */
const METER = { width: 5, fill: '●', empty: '○' }

/** How far the model's name is cut when the bar must squeeze. */
const MODEL_CELLS = 18
/** How many times coarser the bar can get; the richest that fits is drawn. */
const MAX_LEVEL = 4

/** What a press on a block runs; the thinking block's opens the After queue. */
export type BarPress = 'after' | 'model' | 'diff' | 'tree' | 'mark' | 'usage'

export type Pill = {
  key: string
  text: string
  paint: Paint
  isBold?: boolean
  press?: BarPress
  /** A picture drawn in place of the icon, where the terminal can show one. */
  image?: { png: string; columns: number; rows: number; alt: string }
  /** The cells the block takes, padding included, when a picture replaces the text's start. */
  width?: number
}

/** A block as barPills builds it, before the Mocha step gives it its paint. */
type Block = Omit<Pill, 'paint'> & { alert?: Paint }

export type BarInput = {
  usage: Usage
  effort: string | null
  /** The friendly names the settings give the models. */
  labels: Readonly<Record<string, string>>
  /** How many file edits the last turn made. */
  diffCount: number
  isWorking: boolean
  /** Advances while a turn runs: the spinner and the pulse read it. */
  frame: number
}

/** The aliases Claude Code's model setting takes, as the models they name. */
const ALIAS_MODELS: Readonly<Record<string, string>> = {
  opus: 'claude-opus-5-5',
  sonnet: 'claude-sonnet-5-5',
  haiku: 'claude-haiku-5-5',
  fable: 'claude-fable-5-1',
}

/** `claude-opus-5-5[1m]` → `Opus 5.5`; a bare alias as the model it names; anything else as given. */
const prettyModel = (model: string): string => {
  const match = /claude-([a-z]+)-(\d+)(?:-(\d{1,2}))?(?!\d)/i.exec(model)
  if (!match) {
    const named = ALIAS_MODELS[model.replace(/\[1m\]$/i, '').toLowerCase()]

    return named === undefined ? model : prettyModel(named)
  }
  const [, family = '', major, minor] = match
  const name = family.charAt(0).toUpperCase() + family.slice(1).toLowerCase()

  return minor === undefined ? `${name} ${major}` : `${name} ${major}.${minor}`
}

/** The model's own name where the settings' modelPicker gives one, else the pretty one; controls taken out. */
const modelName = (model: string, labels: Readonly<Record<string, string>>): string =>
  (labels[model] ?? labels[model.replace(/\[1m\]$/i, '')] ?? labels[`${model}[1m]`] ?? prettyModel(model))
    .replace(/[\p{Cc}\p{Cf}]/gu, '')
    .trim()

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
export const cells = (text: string): number => [...text].reduce((sum, char) => sum + charCells(char), 0)

/** The text cut to at most `max` cells, an ellipsis where it was cut. */
const cut = (text: string, max: number): string => {
  if (cells(text) <= max) {
    return text
  }
  let out = ''
  let width = 0
  for (const char of text) {
    const next = charCells(char)
    if (width + next > max - 1) {
      break
    }
    out += char
    width += next
  }

  return `${out}…`
}

/**
 * The six blocks at one level of detail: 0 is everything, and each level up
 * drops one thing, in this order: the usage block's token count, its meter,
 * the effort, then the model's name is cut short. The blocks themselves never
 * go: each is the way into its own pane.
 */
const barPills = (input: BarInput, level: number, crab?: { idle: string; typing: string }): Pill[] => {
  const { usage, isWorking, frame } = input
  const name = usage.model === null ? '–' : modelName(usage.model, input.labels)
  const model = level >= 4 ? cut(name, MODEL_CELLS) : name
  const effort = level < 3 && input.effort !== null ? ` · ${input.effort}` : ''
  const percent = usage.contextPercent
  const fill = level < 2 && percent !== null ? meter(percent) : ''
  const tokens = level < 1 && usage.contextTokens !== null ? `· ${formatTokens(usage.contextTokens)}` : ''
  const reading = [percent === null ? '–' : fill, tokens].filter(part => part !== '').join(' ')

  const blocks: Block[] = [
    crab === undefined
      ? { key: 'thinking', text: isWorking ? `${ICONS.claude} ${FRAMES[frame % FRAMES.length]}` : ICONS.claude, isBold: true, press: 'after' }
      : isWorking
        ? {
            key: 'thinking',
            text: FRAMES[frame % FRAMES.length] ?? '',
            width: CRAB_IMAGES.typing.columns + 4,
            image: { png: crab.typing, ...CRAB_IMAGES.typing, alt: ICONS.claude },
            isBold: true,
            press: 'after',
          }
        : {
            key: 'thinking',
            text: '',
            width: CRAB_IMAGES.idle.columns + 3,
            image: { png: crab.idle, ...CRAB_IMAGES.idle, alt: ICONS.claude },
            isBold: true,
            press: 'after',
          },
    { key: 'model', text: `${ICONS.model} ${model}${effort}`, isBold: true, press: 'model' },
    { key: 'diff', text: `${ICONS.diff} diff${input.diffCount > 0 ? ` ${input.diffCount}` : ''}`, press: 'diff' },
    { key: 'tree', text: `${ICONS.tree} tree`, press: 'tree' },
    { key: 'mark', text: `${ICONS.bookmark} marks`, press: 'mark' },
    {
      key: 'usage',
      text: reading === '' ? ICONS.context : `${ICONS.context} ${reading}`,
      alert: alertFor(percent),
      press: 'usage',
    },
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
  pills.reduce((sum, pill) => sum + (pill.width ?? cells(pill.text) + 2), 0) + pills.length + 1

/** The richest blocks that fit in `columns`; the coarsest when none does. */
export const fitPills = (input: BarInput, columns: number, crab?: { idle: string; typing: string }): Pill[] => {
  for (let level = 0; level < MAX_LEVEL; level++) {
    const pills = barPills(input, level, crab)
    if (barWidth(pills) <= columns) {
      return pills
    }
  }

  return barPills(input, MAX_LEVEL, crab)
}

/**
 * A block's text as a button's label: Claude Desktop and VS Code draw a button
 * by its label, not the colored text inside it. Icons become words, any other
 * private-use glyph goes, spaces collapse.
 */
const plainLabel = (text: string): string =>
  [...text]
    .map(char => ICON_WORDS[char] ?? (/[\ue000-\uf8ff]/u.test(char) ? '' : char))
    .join('')
    .replace(/\s+/g, ' ')
    .trim()

/** The elements every surface's table carries; `Button` where a block is pressable. */
export type Elements = {
  Box: ElementConstructor<BoxProps>
  Text: ElementConstructor<TextProps>
  Button?: ElementConstructor<ButtonProps>
  /** The terminal's picture leaf; absent on surfaces that draw none. */
  Image?: ElementConstructor<ImageProps>
}

/**
 * Draws the blocks as a powerline: a round cap, each block on its own
 * background, an arrow in the left block's color over the right one's, a
 * round cap to end. A block with a press is a button (a click, or Enter while
 * the band holds the focus). A Button takes Text children alone, so a picture
 * block's press rides the cells after the picture, never around it.
 */
export const drawPowerline = (
  { Box, Text, Button, Image }: Elements,
  pills: readonly Pill[],
  onPress: (press: BarPress) => void,
) => {
  const first = pills[0]

  return (
    <Box flexDirection="row" flexWrap="nowrap" overflow="hidden">
      {first !== undefined && (
        <Text key="open" color={first.paint.bg}>
          {POWERLINE.open}
        </Text>
      )}
      {pills.flatMap((pill, index) => {
        const following = pills[index + 1]
        const press = pill.press
        const picture = pill.image
        const face =
          picture !== undefined && Image !== undefined ? (
            <Box key={pill.key} flexDirection="row" backgroundColor={pill.paint.bg}>
              <Text backgroundColor={pill.paint.bg} color={pill.paint.fg}>
                {' '}
              </Text>
              <Image
                key={`${pill.key}-image`}
                source={{ png: picture.png }}
                columns={picture.columns}
                rows={picture.rows}
                alt={picture.alt}
              />
              {press !== undefined && Button !== undefined ? (
                <Button
                  key={`${pill.key}-button`}
                  label={plainLabel(pill.text) || press}
                  plain
                  onPress={() => onPress(press)}
                >
                  <Text backgroundColor={pill.paint.bg} color={pill.paint.fg} bold={pill.isBold}>
                    {pill.text === '' ? '  ' : ` ${pill.text} `}
                  </Text>
                </Button>
              ) : (
                <Text backgroundColor={pill.paint.bg} color={pill.paint.fg} bold={pill.isBold}>
                  {pill.text === '' ? ' ' : ` ${pill.text} `}
                </Text>
              )}
            </Box>
          ) : press !== undefined && Button !== undefined ? (
            <Button key={`${pill.key}-button`} label={plainLabel(pill.text) || press} plain onPress={() => onPress(press)}>
              <Text backgroundColor={pill.paint.bg} color={pill.paint.fg} bold={pill.isBold}>
                {` ${pill.text} `}
              </Text>
            </Button>
          ) : (
            <Text key={pill.key} backgroundColor={pill.paint.bg} color={pill.paint.fg} bold={pill.isBold}>
              {` ${pill.text} `}
            </Text>
          )
        return [
          face,
          <Text key={`${pill.key}-edge`} color={pill.paint.bg} backgroundColor={following?.paint.bg}>
            {following === undefined ? POWERLINE.close : POWERLINE.arrow}
          </Text>,
        ]
      })}
    </Box>
  )
}
