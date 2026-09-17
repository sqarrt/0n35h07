extends GutTest
## The arena runs every lobby seat (web Match.buildPlayers): a Battle roster builds four players in two teams, the
## team top bar, and bots that hunt the nearest enemy.

const ARENA := preload("res://scenes/arena_test.tscn")
const PROFILE := {"name": "PARITY7", "primaryColor": "#fa4", "reserveColor": "#4af"}

var _saved := {}

const HOST_PEER := "A"
const GUEST_PEER := "B"
const GUEST_ID := 1
const SEED := "ABCD"

func before_each() -> void:
	_saved = {"roster": Game.lobby_roster, "mode": Game.lobby_mode, "map": Game.selected_map, "room": Game.room,
		"setup": Game.match_setup}

func after_each() -> void:
	Game.lobby_roster = _saved["roster"]
	Game.lobby_mode = _saved["mode"]
	Game.selected_map = _saved["map"]
	Game.room = _saved["room"]
	Game.match_setup = _saved["setup"]

func test_a_room_start_boots_a_mesh_match() -> void:
	var rng := func() -> float: return 0.0
	var profile := PlayerProfile.sanitize(PROFILE, rng)
	Game.selected_map = MapCatalog.raw_path(MapCatalog.MAP_IDS[0])
	Game.lobby_mode = GameModes.DUEL
	Game.lobby_roster = [Roster.human_entry(0, profile), Roster.human_entry(GUEST_ID, profile)]
	Game.room = RoomSession.new(LoopbackNet.new(GUEST_PEER), RoomSession.ROLE_HOST, profile, rng)
	Game.match_setup = {"owners": {0: HOST_PEER, GUEST_ID: GUEST_PEER}, "self_peer": GUEST_PEER, "local_id": GUEST_ID,
		"seed": SEED, "spawns": []}
	var arena := ARENA.instantiate()
	add_child(arena)
	await wait_process_frames(2)
	var match_node := arena.find_children("*", "MatchNode", true, false)[0] as MatchNode
	assert_eq(match_node.local_id, GUEST_ID, "the guest plays its own seat")
	assert_false(match_node.owns(0), "the host's player is the host's")
	assert_not_null(match_node.net_session, "facts go out on the room's transport")
	for pnode in arena.find_children("*", "PlayerNode", true, false):
		var id := (pnode as PlayerNode).player.id
		assert_eq((pnode as PlayerNode).replay, id != GUEST_ID, "only the remote player is shown from snapshots")
	arena.free()
	assert_null(Game.room, "leaving the arena closes the room")

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
