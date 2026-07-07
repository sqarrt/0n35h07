import { IS_DESKTOP } from '../../platform'
import type { BotDifficulty } from '../../constants'

/** A single player in a lobby slot. */
export interface LobbySlot { name: string; color: string; ready: boolean }
/** Opponent slot: a bot or a remote human. */
export type OppSlot = LobbySlot & { isBot: boolean }
/** A Steam invite the host has sent and is waiting on (rendered onto the first free seats). */
export interface PendingInvite { id: string; name: string }
/** A seat of the unified Seats block: index, occupant (null = free), whose it is, team group. */
export interface SeatView {
  slot: number
  entry: { name: string; color: string; ready: boolean; isBot: boolean; difficulty?: BotDifficulty } | null
  mine: boolean
  team: number   // teamOfSlot(mode, slot); highlighted only in 2v2
}
/** Which click zone of a seat fired: add a bot (host) or move myself here (client). */
export type SeatZone = 'addbot' | 'move'
/** Subtab of the "Play" screen. */
export type LobbyTab = 'matchmaking' | 'friend' | 'bot'

// The Steam (desktop) build keeps Matchmaking (Steam quick-match); the web build drops it — there
// must be no web↔Steam cross-play, and web matchmaking is Steam-only's counterpart. "With friend"
// and "With bot" exist on both (friend = Steam invite on desktop, room code on web).
export const LOBBY_TABS: readonly LobbyTab[] = IS_DESKTOP ? ['matchmaking', 'friend', 'bot'] : ['friend', 'bot']
export const DEFAULT_LOBBY_TAB: LobbyTab = IS_DESKTOP ? 'matchmaking' : 'friend'
