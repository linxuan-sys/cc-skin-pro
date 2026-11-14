// Colors a bookmarked selection inside a reply's markdown: each selected word
// is wrapped as inline code, which Claude Code draws in its code color. Only
// the text shown changes (not the stored message, not what the model reads),
// and only words change, so the lines wrap as before.

const isWordChar = (ch: string) => /[\p{L}\p{N}]/u.test(ch)

// Characters that carry markdown meaning: a highlight never covers them, so
// links, emphasis, tables and escapes keep working.
const SPECIAL = new Set(['`', '*', '_', '[', ']', '(', ')', '<', '>', '|', '\\', '~', '#', '&', '!'])

/**
 * Where the selected text is in the source: the offsets of its first and
 * last word character, matched on letters and digits alone (the selection
 * is the text as drawn, without markdown). With several matches, the one
 * nearest `near` (0 the source's start, 1 its end).
 */
export function findSelection(source: string, selected: string, near: number): { start: number; end: number } | undefined {
  const wanted = Array.from(selected).filter(isWordChar).join('').toLowerCase()
  if (wanted.length < 2) return undefined
  // Claude Code draws neither fence lines (with their language) nor, where
  // the terminal shows links as links, a link's target: try without them
  // first, then with the targets, for a terminal that prints them.
  return nearestMatch(source, wanted, near, hiddenOffsets(source, true)) ??
    nearestMatch(source, wanted, near, hiddenOffsets(source, false))
}

function hiddenOffsets(source: string, hideLinkTargets: boolean): boolean[] {
  const hidden = Array.from({ length: source.length }, () => false)
  const hide = (from: number, to: number) => {
    for (let i = from; i < to; i++) hidden[i] = true
  }
  for (const m of source.matchAll(/^[ \t]*(```|~~~).*$/gm)) hide(m.index, m.index + m[0].length)
  if (hideLinkTargets) {
    for (const m of source.matchAll(/\]\([^)\n]*\)/g)) hide(m.index, m.index + m[0].length)
  }
  return hidden
}

function nearestMatch(source: string, wanted: string, near: number, hidden: boolean[]) {
  let flat = ''
  const at: number[] = []
  Array.from(source).reduce((offset, ch) => {
    if (isWordChar(ch) && !hidden[offset]) {
      flat += ch.toLowerCase()
      at.push(offset)
    }
    return offset + ch.length
  }, 0)
  let best: { start: number; end: number; distance: number } | undefined
  for (let i = flat.indexOf(wanted); i !== -1; i = flat.indexOf(wanted, i + 1)) {
    const start = at[i] ?? 0
    const end = (at[i + wanted.length - 1] ?? start) + 1
    const distance = Math.abs(start / Math.max(1, source.length) - near)
    if (best === undefined || distance < best.distance) best = { start, end, distance }
  }
  return best && { start: best.start, end: best.end }
}

// Offsets on one line a highlight must leave alone: the block markers before
// the content (indent, quote, list marker, heading), link targets, autolinks
// and inline code that is there already.
function protectedOffsets(line: string): boolean[] {
  const kept = Array.from({ length: line.length }, () => false)
  const lead = /^(\s*(?:>\s*)*(?:[-*+]\s+|\d+[.)]\s+|#{1,6}\s+)?(?:\[[ xX]\]\s+)?)/.exec(line)?.[0].length ?? 0
  for (let i = 0; i < lead; i++) kept[i] = true
  const spans = [/\]\([^)]*\)/g, /<[^>\s]+>/g, /`[^`]*`/g]
  for (const rx of spans) {
    for (const m of line.matchAll(rx)) {
      for (let i = m.index; i < m.index + m[0].length; i++) kept[i] = true
    }
  }
  return kept
}

// Lines that are markdown structure, not text: fences, rules, table
// separators, setext underlines.
const isStructure = (line: string) =>
  /^\s*(```|~~~)/.test(line) ||
  /^\s*([-*_])(\s*\1){2,}\s*$/.test(line) ||
  /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/.test(line) ||
  /^\s*=+\s*$/.test(line)

function wrapWords(line: string, from: number, to: number): string {
  const kept = protectedOffsets(line)
  let out = ''
  let word = ''
  const flush = () => {
    if (word !== '') out += `\`${word}\``
    word = ''
  }
  for (let i = 0; i < line.length; i++) {
    const ch = line[i] ?? ''
    const inside = i >= from && i < to
    // An underscore between two letters is part of a word, not emphasis.
    const intraword = ch === '_' && isWordChar(line[i - 1] ?? '') && isWordChar(line[i + 1] ?? '')
    const plain = inside && !kept[i] && !/\s/.test(ch) && (!SPECIAL.has(ch) || intraword)
    if (plain) {
      word += ch
    } else {
      flush()
      out += ch
    }
  }
  flush()
  return out
}

/**
 * The source with the selected words colored; the source unchanged when
 * the selection isn't found. Code blocks and structure lines are left as
 * they are.
 */
export function highlightSelection(source: string, selected: string, near: number): string {
  const found = findSelection(source, selected, near)
  if (found === undefined) return source
  let inFence = false
  let offset = 0
  return source
    .split('\n')
    .map(line => {
      const lineStart = offset
      offset += line.length + 1
      const isFence = /^\s*(```|~~~)/.test(line)
      const wasInFence = inFence
      if (isFence) inFence = !inFence
      if (isFence || wasInFence || isStructure(line)) return line
      const from = Math.max(found.start, lineStart) - lineStart
      const to = Math.min(found.end, lineStart + line.length) - lineStart
      return from < to ? wrapWords(line, from, to) : line
    })
    .join('\n')
}
