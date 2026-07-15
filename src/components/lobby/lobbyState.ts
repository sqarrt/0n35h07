import { teamOfSlot, MODE_SLOT_COUNT } from '../../game/modes'
import type { GameMode } from '../../game/modes'
import type { RoomView } from '../../net/RoomSession'
import type { MapFilter, DurationFilter } from '../../constants'
import type { SeatView } from './types'

/**
 * RoomView → the Lobby screen's state. Pure and side-effect free (App wires the handlers on top), so the
 * seat rules are unit-testable without a session: who sits where, what a guest may see before ASSIGN, and
 * what to show while no session exists yet.
 */

export interface LobbyStateInput {
  /** Live room state; null while no session exists yet (a Steam lobby still forming). */
  view: RoomView | null
  /** Shown on my own seat in the no-session fallback. */
  self: { name: string; color: string }
  /** This side's map/duration wishes — used until a session resolves them. */
  draft: { map: MapFilter; durationMin: DurationFilter }
  /** Intended role for the no-session fallback: it keeps my seat on a stable side instead of blinking. */
  fallbackIsHost: boolean
}

export interface LobbyState {
  isHost: boolean
  mode: GameMode
  seats: SeatView[]
  connected: boolean
  myReady: boolean
  canStart: boolean
  mapSel: MapFilter
  durationSel: DurationFilter
}

export function lobbyStateFrom({ view, self, draft, fallbackIsHost }: LobbyStateInput): LobbyState {
  const isHost = view ? view.isHost : fallbackIsHost
  const mode: GameMode = view?.mode ?? '1v1'
  const myId = view?.localPlayerId ?? -1   // host: seat 0; client: assigned seat (-1 until ASSIGN)
  let seats: SeatView[]
  if (view) {
    // A guest sees the others ONLY after connecting (ASSIGN) — otherwise its own host stub reads as a "match with yourself".
    seats = view.slots.map((e, slot) => ({
      slot,
      entry: (isHost || view.connected) && e
        ? { name: e.name, color: e.color, ready: view.ready.includes(e.id), isBot: e.kind === 'bot', difficulty: e.difficulty }
        : null,
      mine: myId >= 0 && e?.id === myId,
      team: teamOfSlot(mode, slot),
    }))
  } else {
    // No session yet: show me on my expected side of a Duel pair so the screen doesn't blink empty.
    const mySlot = isHost ? 0 : 1
    seats = Array.from({ length: MODE_SLOT_COUNT[mode] }, (_, slot) => ({
      slot,
      entry: slot === mySlot ? { name: self.name, color: self.color, ready: false, isBot: false } : null,
      mine: slot === mySlot,
      team: teamOfSlot(mode, slot),
    }))
  }
  return {
    isHost, mode, seats,
    connected: view?.connected ?? false,
    myReady: view ? view.ready.includes(myId) : false,
    canStart: view?.canStart ?? false,
    mapSel: view?.mapSel ?? draft.map,
    durationSel: view?.durationSel ?? draft.durationMin,
  }
}
