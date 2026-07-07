/** Game mode is a LOBBY preset (slot count, team layout, start gate, spawn rule).
 *  The simulation itself is always team-based and has NO branching on the mode. */
export type GameMode = '1v1' | '2v2' | 'ffa'

export const GAME_MODES: GameMode[] = ['1v1', '2v2', 'ffa']

export const MODE_SLOT_COUNT: Record<GameMode, number> = { '1v1': 2, '2v2': 4, 'ffa': 4 }

/** Mode display names — universal brand words, NOT localized (the i18n lobbyMode* keys are the subtitles). */
export const MODE_LABEL: Record<GameMode, string> = { '1v1': 'Duel', '2v2': 'Battle', 'ffa': 'War' }

const FFA_MIN_PLAYERS = 2   // an FFA room may start as a pair (degenerate duel with random spawns)
const TEAM_SIZE_2V2 = 2     // slots 0-1 → team 0, slots 2-3 → team 1

/** Team of a slot under the mode's preset. 1v1/FFA: everyone is their own team. */
export function teamOfSlot(mode: GameMode, slot: number): number {
  return mode === '2v2' ? Math.floor(slot / TEAM_SIZE_2V2) : slot
}

/** Start gate: 1v1 — both slots, 2v2 — full teams, FFA — at least a pair. */
export function canStartFor(mode: GameMode, occupiedCount: number): boolean {
  if (mode === 'ffa') return occupiedCount >= FFA_MIN_PLAYERS
  return occupiedCount === MODE_SLOT_COUNT[mode]
}
