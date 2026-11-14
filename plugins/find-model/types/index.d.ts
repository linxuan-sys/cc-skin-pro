/** The model picker's state, kept in `$.state`. */
export type ModelState = {
  /** The model the session runs on ('' before any pick). */
  current: string
  /** The caret row; ↑↓/j k move it, Enter or a second click switches to it. */
  cursor: string
  /** The search text; '' shows the whole list. */
  filter: string
  /** The effort level, or null for the model's own default. */
  effort: string | null
  /** Every model the picker offers, as /model shows them. */
  models: string[]
  /** A friendly label for a model id, where the settings give one. */
  labels: Record<string, string>
  /** The window's top row, or null to follow the cursor (centred). */
  scroll: number | null
}

declare module 'claude-code' {
  interface PluginState {
    'find-model': {
      view: ModelState
    }
  }
}
