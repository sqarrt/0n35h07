extends GutTest
## Game modes parity with web game/modes.ts: a mode is a lobby preset — seat count, team layout and start gate.

func test_seat_counts_and_labels() -> void:
	assert_eq(GameModes.GAME_MODES, ["1v1", "2v2", "ffa"])
	assert_eq(GameModes.slot_count(GameModes.DUEL), 2)
	assert_eq(GameModes.slot_count(GameModes.BATTLE), 4)
	assert_eq(GameModes.slot_count(GameModes.WAR), 4)
	assert_eq(GameModes.label(GameModes.DUEL), "Duel")
	assert_eq(GameModes.label(GameModes.BATTLE), "Battle")
	assert_eq(GameModes.label(GameModes.WAR), "War")

func test_team_layout() -> void:
	assert_eq(GameModes.team_of_slot(GameModes.DUEL, 1), 1, "1v1: everyone is their own team")
	assert_eq(GameModes.team_of_slot(GameModes.WAR, 3), 3, "FFA too")
	assert_eq(GameModes.team_of_slot(GameModes.BATTLE, 1), 0, "2v2: slots 0-1 are team 0")
	assert_eq(GameModes.team_of_slot(GameModes.BATTLE, 2), 1, "slots 2-3 are team 1")

func test_start_gate() -> void:
	assert_false(GameModes.can_start_for(GameModes.DUEL, 1))
	assert_true(GameModes.can_start_for(GameModes.DUEL, 2), "1v1: both seats")
	assert_false(GameModes.can_start_for(GameModes.BATTLE, 3))
	assert_true(GameModes.can_start_for(GameModes.BATTLE, 4), "2v2: full teams")
	assert_false(GameModes.can_start_for(GameModes.WAR, 1))
	assert_true(GameModes.can_start_for(GameModes.WAR, 2), "FFA: at least a pair")
