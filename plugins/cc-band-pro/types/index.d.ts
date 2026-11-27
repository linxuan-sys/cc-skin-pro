/** One line of an edit's diff: kept (' '), added, or removed. */
export type DiffLine = { op: '+' | '-' | ' '; t: string }

/** One file edit of the last turn, as the diff pane shows it. */
export type DiffStep = { tool: string; file: string; diff: DiffLine[]; note: string }

/** What the bar reads of the session: how full its context is. */
export type Usage = {
  /** How full the context window is, 0 to 100; null before the first reading. */
  contextPercent: number | null
  /** The tokens in context; null before the first reading. */
  contextTokens: number | null
}

declare module 'claude-code' {
  interface PluginState {
    'cc-band-pro': {
      /** The spinner's frame: it advances while a turn runs and drops back to 0 after. */
      frame: number
      usage: Usage
      /** The last turn's file edits: the diff block counts them, the diff pane walks them. */
      diffSteps: DiffStep[]
      /** The step the diff pane shows. */
      diffIndex: number
    }
  }
}

declare module 'claude-code' {
  interface EngineInterface {
    /** Companion bridges; each is absent when that plugin is not installed. */
    after: { open: () => Promise<void> }
    filetree: { open: () => Promise<void> }
    bookmarks: { open: () => Promise<void> }
    sessionMeter: { open: () => Promise<void> }
    /** The pi plugin's bridge; absent when that plugin is not loaded. */
    pi: { open: () => Promise<void> }
  }
}
