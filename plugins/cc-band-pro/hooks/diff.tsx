import type { RenderElement } from 'claude-code'

import type { DiffLine, DiffStep } from '../types'
import { cells } from './bar'
import type { Elements } from './bar'

/** The pane a press on the bar's diff block opens. */
export const DIFF_PANE = 'mocha-diff'

/** Catppuccin Mocha, as cc-skin-pro's diff pane wears it under that skin. */
const COLORS = {
  frame: '#cba6f7', // mauve: the frame, the title, the step marked
  file: '#89b4fa', // blue: the file and the step count
  muted: '#82869e', // overlay: notes and hints
  added: '#a6e3a1', // green
  removed: '#f38ba8', // red
}

/** The tools whose calls are recorded, and how much diff is worth computing. */
const EDIT_TOOLS = new Set(['Edit', 'Write', 'MultiEdit'])
const MAX_LCS_LINES = 400
/** How many steps the strip at the top lists before it says how many more. */
const MAX_STRIP = 20

/** Whether a tool call is one the diff records. */
export const isEditTool = (tool: string): boolean => EDIT_TOOLS.has(tool)

const splitLines = (text: unknown): string[] => {
  if (text === undefined || text === null || text === '') {
    return []
  }
  const lines = String(text).split('\n')
  if (lines.length > 1 && lines[lines.length - 1] === '') {
    lines.pop()
  }

  return lines
}

/** Keeps one line of context around each change, so a long file shows its changed lines, not all of it. */
const trimContext = (lines: DiffLine[]): DiffLine[] => {
  if (!lines.some(line => line.op !== ' ')) {
    return lines
  }
  const keep = lines.map(
    (line, k) =>
      line.op !== ' ' ||
      (lines[k - 1] !== undefined && lines[k - 1]!.op !== ' ') ||
      (lines[k + 1] !== undefined && lines[k + 1]!.op !== ' '),
  )
  const out: DiffLine[] = []
  let skipped = false
  lines.forEach((line, k) => {
    if (keep[k] === true) {
      if (skipped && out.length > 0) {
        out.push({ op: '~', t: '⋯' })
      }
      out.push(line)
      skipped = false
    } else {
      skipped = true
    }
  })

  return out
}

/**
 * A line diff: small inputs get an LCS diff, so unchanged lines show as
 * context; a large one falls back to all removed then all added.
 */
export const diffLines = (oldText: unknown, newText: unknown): DiffLine[] => {
  const a = splitLines(oldText)
  const b = splitLines(newText)
  if (a.length > MAX_LCS_LINES || b.length > MAX_LCS_LINES) {
    return [...a.map(t => ({ op: '-' as const, t })), ...b.map(t => ({ op: '+' as const, t }))]
  }
  const n = a.length
  const m = b.length
  const dp = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i]![j] = a[i] === b[j] ? dp[i + 1]![j + 1]! + 1 : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!)
    }
  }
  const out: DiffLine[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ op: ' ', t: a[i]! })
      i += 1
      j += 1
    } else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) {
      out.push({ op: '-', t: a[i]! })
      i += 1
    } else {
      out.push({ op: '+', t: b[j]! })
      j += 1
    }
  }
  while (i < n) {
    out.push({ op: '-', t: a[i]! })
    i += 1
  }
  while (j < m) {
    out.push({ op: '+', t: b[j]! })
    j += 1
  }

  return trimContext(out)
}

const countChanges = (diff: readonly DiffLine[]) => {
  let add = 0
  let del = 0
  for (const line of diff) {
    if (line.op === '+') add += 1
    else if (line.op === '-') del += 1
  }

  return { add, del }
}

export type DiffView = {
  steps: readonly DiffStep[]
  index: number
  /** Cells across the pane's body, for wrapping the estimate. */
  columns: number
  /** Rows the body may show, so a diff stops where the pane does. */
  bodyRows: number
}

export type DiffActions = {
  go: (index: number) => void
  close: () => void
}

/**
 * The diff pane: the edits of the last turn, one step at a time: a mauve
 * frame and title, green additions, red removals.
 */
export const drawDiff = ({ Box, Text, Button }: Elements, view: DiffView, act: DiffActions) => {
  const { steps } = view

  if (steps.length === 0 || Button === undefined) {
    return (
      <Box flexDirection="column" borderStyle="round" borderColor={COLORS.frame} paddingX={1}>
        <Text key="title" bold color={COLORS.frame}>
          {'Diff'}
        </Text>
        <Text key="empty" color={COLORS.muted}>
          {'No edits in the last turn yet.'}
        </Text>
        <Text key="hint" color={COLORS.muted}>
          {'Every Edit, MultiEdit and Write of a turn is kept here; the diff block counts them.'}
        </Text>
      </Box>
    )
  }

  const total = steps.length
  const k = Math.max(0, Math.min(view.index, total - 1))
  const step = steps[k]!
  const width = Math.max(40, view.columns - 4)
  const maxDiff = Math.max(4, view.bodyRows - 8)
  const { add, del } = countChanges(step.diff)

  // Long lines wrap; maxDiff counts screen rows, estimated from the line's
  // length, so a wrapped line uses up more of the budget.
  const rows: RenderElement[] = []
  let used = 0
  let shown = 0
  for (const line of step.diff) {
    const full = `${line.op === '~' ? ' ' : line.op} ${line.t}`
    const estimate = Math.max(1, Math.ceil(cells(full) / width))
    if (used > 0 && used + estimate > maxDiff) {
      break
    }
    const color = line.op === '+' ? COLORS.added : line.op === '-' ? COLORS.removed : undefined
    rows.push(
      <Text key={`d${shown}`} color={color} dimColor={line.op === ' ' || line.op === '~'} wrap="wrap">
        {full}
      </Text>,
    )
    used += estimate
    shown += 1
  }
  if (step.diff.length > shown) {
    rows.push(<Text key="more" color={COLORS.muted}>{`  … ${step.diff.length - shown} more lines`}</Text>)
  }
  if (shown === 0) {
    rows.push(<Text key="empty-diff" color={COLORS.muted}>{'  (no line changes)'}</Text>)
  }

  const strip = steps.slice(0, MAX_STRIP).map((_, n) => (
    <Button key={`step-${n}`} label={`${n + 1}`} variant={n === k ? 'primary' : undefined} onPress={() => act.go(n)}>
      <Text key={`s${n}`} color={n === k ? COLORS.frame : COLORS.muted} bold={n === k}>
        {` ${n + 1} `}
      </Text>
    </Button>
  ))

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={COLORS.frame} paddingX={1}>
      <Box key="head" flexDirection="row" justifyContent="space-between">
        <Text bold color={COLORS.frame}>
          {'Diff'}
        </Text>
        <Text bold color={COLORS.file}>{`step ${k + 1} of ${total}`}</Text>
      </Box>
      <Box key="strip" flexDirection="row" flexWrap="wrap">
        {strip}
        {total > MAX_STRIP && <Text color={COLORS.muted}>{`  … ${total - MAX_STRIP} more`}</Text>}
      </Box>
      <Text key="file" bold color={COLORS.file} wrap="truncate-start">
        {step.file}
      </Text>
      <Box key="meta" flexDirection="row" columnGap={2}>
        <Text color={COLORS.muted}>{`${step.tool}${step.note === '' ? '' : ` · ${step.note}`}`}</Text>
        <Text color={COLORS.added}>{`+${add}`}</Text>
        <Text color={COLORS.removed}>{`-${del}`}</Text>
      </Box>
      <Box key="lines" flexDirection="column" marginTop={1}>
        {rows}
      </Box>
      <Box key="actions" flexDirection="row" marginTop={1} columnGap={1}>
        <Button key="prev" label="◀ Prev" hotkey="p" onPress={() => act.go(k - 1)} />
        <Button key="next" label="Next ▶" hotkey="n" autoFocus onPress={() => act.go(k + 1)} />
        <Button key="close" label="Close" hotkey="c" onPress={act.close} />
      </Box>
      <Text key="hint" color={COLORS.muted} wrap="truncate-end">
        {'↑↓ or the numbers walk the steps · p/n step · Esc closes'}
      </Text>
    </Box>
  )
}
