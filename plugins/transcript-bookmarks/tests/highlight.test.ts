import { expect, test } from 'claude-code/testing'

import { findSelection, highlightSelection } from '../hooks/highlight'

test('colors each selected word of plain lines, and no other line', () => {
  const source = 'L069 the quick brown fox\nL070 the quick brown fox\nL071 the quick brown fox'
  expect(highlightSelection(source, 'L070 the quick brown fox', 0)).toBe(
    'L069 the quick brown fox\n`L070` `the` `quick` `brown` `fox`\nL071 the quick brown fox',
  )
})

test('keeps markdown working: list markers, emphasis, links, inline code, headings', () => {
  expect(highlightSelection('- Use **bold** and [a link](https://x.y) here', 'Use bold and a link here', 0)).toBe(
    '- `Use` **`bold`** `and` [`a` `link`](https://x.y) `here`',
  )
  expect(highlightSelection('run `npm test` now', 'run npm test now', 0)).toBe('`run` `npm test` `now`')
  expect(highlightSelection('call my_func now', 'call my_func now', 0)).toBe('`call` `my_func` `now`')
  expect(highlightSelection('1. First item', '1. First item', 0)).toBe('1. `First` `item`')
  expect(highlightSelection('## Title here', 'Title here', 0)).toBe('## `Title` `here`')
})

test('leaves code blocks and table separators as they are', () => {
  const source = 'Before\n```ts\nconst x = 1\n```\nAfter'
  expect(highlightSelection(source, 'Before const x = 1 After', 0)).toBe('`Before`\n```ts\nconst x = 1\n```\n`After`')
  const table = '| a | b |\n|---|---|\n| one | two |'
  expect(highlightSelection(table, 'a b one two', 0)).toBe('| `a` | `b` |\n|---|---|\n| `one` | `two` |')
})

test('a selection across wrapped lines matches, and the nearest of repeated text wins', () => {
  // The selection is the text as drawn: no markdown, wrapped lines joined.
  expect(findSelection('A **long** sentence\nthat goes on', 'long sentence that goes', 0)).toEqual({ start: 4, end: 29 })
  expect(highlightSelection('fox\nmid\nfox', 'fox', 1)).toBe('fox\nmid\n`fox`')
  expect(highlightSelection('fox\nmid\nfox', 'fox', 0)).toBe('`fox`\nmid\nfox')
})

test('text that is not in the reply changes nothing', () => {
  expect(highlightSelection('Some reply', 'something else', 0)).toBe('Some reply')
  expect(highlightSelection('Some reply', 'x', 0)).toBe('Some reply')
})
