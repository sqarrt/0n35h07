import { setRichPresence } from './steam'

// The app's top-level screens (mirrors App's Screen union; kept local to stay decoupled).
export type AppScreen = 'menu' | 'lobby' | 'game' | 'settings' | 'appearance' | 'about' | 'trailer' | 'radio'

// Steam Rich Presence `steam_display` takes a localization TOKEN (defined in the partner
// portal's Rich Presence localization, e.g. "#Status_InMatch" → "In a match"). Until those
// tokens are defined the call is harmless; friends just see no status text.
const STATUS_KEY = 'steam_display'
const TOKEN_MENU = '#Status_InMenu'
const TOKEN_LOBBY = '#Status_InLobby'
const TOKEN_MATCH = '#Status_InMatch'

/** Pure: map a screen to its Rich Presence display token. */
export function screenStatusToken(screen: AppScreen): string {
  switch (screen) {
    case 'lobby': return TOKEN_LOBBY
    case 'game':  return TOKEN_MATCH
    default:      return TOKEN_MENU   // menu / settings / appearance / about / trailer / radio
  }
}

/** Push the current screen as Steam Rich Presence. Fire-and-forget; no-op off-Steam. */
export function applyScreenPresence(screen: AppScreen): void {
  void setRichPresence(STATUS_KEY, screenStatusToken(screen))
}
