export type BookmarkKind = 'user' | 'assistant' | 'tool' | 'selection'

/**
 * Where the window stood in a transcript row, in terminal lines of that row:
 * `first`, the row's line at the window's top; `of`, the row's height then.
 */
export type RowView = { first: number; of: number }

/**
 * A selection Go to colors in its reply: the bookmark's id, the selected
 * text, and about where it is (0 the top, 1 the end).
 */
export type Highlight = { id: string; text: string; near: number }

export type Bookmark = {
  id: string
  /** The transcript row to scroll back to; absent when a selection spanned several rows. */
  requestId?: string
  /**
   * A selection's place in a row whose top was scrolled away: where the window
   * stood when the text was selected, for Go to's ▶ marker. Absent when the
   * row's top was on screen.
   */
  view?: RowView
  kind: BookmarkKind
  title: string
  excerpt: string
  createdAt: number
}

declare module 'claude-code' {
  interface PluginState {
    'transcript-bookmarks': {
      list: Bookmark[]
      /** The session id the list was loaded for, so a hot reload keeps it and a /clear drops it. */
      loadedFor: string
      /** Per transcript row: whether a bookmark points at it, so each row redraws alone. */
      marked: StateFamily<boolean>
      /** Per transcript row: the line Go to marks with ▶, 0 for none, so each row redraws alone. */
      markerLine: StateFamily<number>
      /** Per transcript row: the selection Go to colors in it, null for none. */
      highlight: StateFamily<Highlight | null>
      /** The row with the ▶ marker or a highlight now; '' when none has one. */
      markerRow: string
    }
  }
}
