extends GutTest
## The arena runs every lobby seat (web Match.buildPlayers): a Battle roster builds four players in two teams, the
## team top bar, and bots that hunt the nearest enemy.

const ARENA := preload("res://scenes/arena_test.tscn")
const PROFILE := {"name": "PARITY7", "primaryColor": "#fa4", "reserveColor": "#4af"}

var _saved := {}

func before_each() -> void:
	_saved = {"roster": Game.lobby_roster, "mode": Game.lobby_mode, "map": Game.selected_map}

func after_each() -> void:
	Game.lobby_roster = _saved["roster"]
	Game.lobby_mode = _saved["mode"]
	Game.selected_map = _saved["map"]

func test_a_battle_roster_builds_two_teams() -> void:
	var rng := func() -> float: return 0.0
	Game.selected_map = MapCatalog.raw_path(MapCatalog.MAP_IDS[0])
	Game.lobby_mode = GameModes.BATTLE
	Game.lobby_roster = [Roster.human_entry(0, PlayerProfile.sanitize(PROFILE, rng)), Roster.bot_entry(1, "B1", "normal"),
		Roster.bot_entry(2, "B2", "passive"), Roster.bot_entry(3, "B3", "normal")]
	var arena := ARENA.instantiate()
	add_child_autofree(arena)
	await wait_process_frames(2)
	var match_node := arena.find_children("*", "MatchNode", true, false)[0] as MatchNode
	assert_eq(match_node.players().size(), 4, "every seat plays")
	var teams := {}
	for score in match_node.scores():
		teams[score["id"]] = score["team"]
	assert_eq(teams, {0: 0, 1: 0, 2: 1, 3: 1}, "web teamOfSlot: slots 0-1 and 2-3")
	assert_not_null(arena.find_child("TeamBar", true, false), "more than two players: the team top bar")
	var plates := {}
	for pnode in arena.find_children("*", "PlayerNode", true, false):
		plates[(pnode as PlayerNode).player.id] = (pnode as PlayerNode).nameplate()
	assert_null(plates[0], "never over the own model")
	for id in [1, 2, 3]:
		assert_not_null(plates[id], "a plate over player %d" % id)
	assert_eq(plates[1].text(), "B1")
