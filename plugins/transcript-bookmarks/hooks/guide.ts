// The count Go to shows while you scroll to a ▶ marker: plain functions of
// the line numbers the terminal reports for a transcript row (`onScreen`).

/** The row's lines `first` to `last` are on screen, of its `of` lines. */
export type OnScreen = { first: number; last: number; of: number }

/** What the toast says, and whether the marker is where the window should be. */
export type GuideText = { text: string; isThere: boolean }

/**
 * The transcript window's height in lines, when the row is taller than the
 * window and so fills it; undefined otherwise.
 */
export function windowLinesOf(onScreen: OnScreen): number | undefined {
  return onScreen.first > 0 && onScreen.last < onScreen.of - 1
    ? onScreen.last - onScreen.first + 1
    : undefined
}

/**
 * How many lines the marker on `line` is below the window's top (negative:
 * above it), or 'shown' while the whole row is on screen.
 *
 * While the row's top is in the window, the lines above the row count too:
 * `windowLines` tells how far down the window the row starts.
 */
export function markerDistance(
  line: number,
  onScreen: OnScreen,
  windowLines: number | undefined,
): number | 'shown' {
  if (onScreen.first > 0) return line - onScreen.first
  if (onScreen.last >= onScreen.of - 1) return 'shown'
  const top = windowLines === undefined ? 0 : Math.max(0, windowLines - 1 - onScreen.last)
  return line + top
}

const lineCount = (n: number) => (n === 1 ? '1 line' : `${n} lines`)

export function guideText(distance: number | 'shown'): GuideText {
  if (distance === 'shown') return { text: '▶ is on screen: you selected the text there', isThere: true }
  if (distance === 0) {
    return { text: '▶ is at the top of the window: this is where you selected the text', isThere: true }
  }
  return distance > 0
    ? { text: `▶ is ${lineCount(distance)} below the top of the window: scroll down`, isThere: false }
    : { text: `▶ is ${lineCount(-distance)} above the top of the window: scroll up`, isThere: false }
}
