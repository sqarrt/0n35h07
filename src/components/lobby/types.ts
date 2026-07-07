import { IS_DESKTOP } from '../../platform'

/** A single player in a lobby slot. */
export interface LobbySlot { name: string; color: string; ready: boolean }
/** Opponent slot: a bot or a remote human. */
export type OppSlot = LobbySlot & { isBot: boolean }
/** A seat of the multi-slot lobby (2v2/FFA grid): index, occupant (null = free), whose it is, team group. */
export interface SeatView {
  slot: number
  entry: { name: string; color: string; ready: boolean; isBot: boolean } | null
  mine: boolean
  team: number   // teamOfSlot(mode, slot); highlighted only in 2v2
}
/** Subtab of the "Play" screen. */
export type LobbyTab = 'matchmaking' | 'friend' | 'bot'

// The Steam (desktop) build keeps Matchmaking (Steam quick-match); the web build drops it — there
// must be no web↔Steam cross-play, and web matchmaking is Steam-only's counterpart. "With friend"
// and "With bot" exist on both (friend = Steam invite on desktop, room code on web).
export const LOBBY_TABS: readonly LobbyTab[] = IS_DESKTOP ? ['matchmaking', 'friend', 'bot'] : ['friend', 'bot']
export const DEFAULT_LOBBY_TAB: LobbyTab = IS_DESKTOP ? 'matchmaking' : 'friend'
