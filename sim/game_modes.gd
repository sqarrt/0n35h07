class_name GameModes
## Game modes — port of web game/modes.ts: a mode is a LOBBY preset (seat count, team layout, start gate); the match
## itself is always team-based and never branches on the mode.

const DUEL := "1v1"
const BATTLE := "2v2"
const WAR := "ffa"
const GAME_MODES := [DUEL, BATTLE, WAR]
const SLOT_COUNT := {DUEL: 2, BATTLE: 4, WAR: 4}
## Display names — universal brand words, not localised (web MODE_LABEL).
const LABELS := {DUEL: "Duel", BATTLE: "Battle", WAR: "War"}
const FFA_MIN_PLAYERS := 2              # an FFA room may start as a pair
const TEAM_SIZE_2V2 := 2                # slots 0-1 -> team 0, slots 2-3 -> team 1

static func slot_count(mode: String) -> int:
	return SLOT_COUNT[mode]

static func label(mode: String) -> String:
	return LABELS[mode]

## Team of a seat under the mode: 1v1 / FFA — everyone is their own team.
static func team_of_slot(mode: String, slot: int) -> int:
	return slot / TEAM_SIZE_2V2 if mode == BATTLE else slot

## Start gate: 1v1 — both seats, 2v2 — full teams, FFA — at least a pair.
static func can_start_for(mode: String, occupied: int) -> bool:
	if mode == WAR:
		return occupied >= FFA_MIN_PLAYERS
	return occupied == slot_count(mode)
