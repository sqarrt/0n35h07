import type { BotDifficulty } from '../../constants'

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
