extends GutTest
## Local host room parity with web RoomSession host rules: seats per mode, bots (auto-ready, generated or given names,
## difficulty), mode switches that compact the seated players, the map / duration resolution and the auto-start.

const PROFILE := {"name": "PARITY7", "primaryColor": "#fa4", "reserveColor": "#4af"}
const ALL_MAPS := ["os_arena", "os_india", "os_pillars"]
const FIRST_ROLL := 0.0
const SECOND_ROLL := 0.6               # the second of two or three options (web pickRandom: floor(random * count))

var _started: Array = []

func _room(roll := FIRST_ROLL) -> RoomModel:
	_started = []
	var rng := func() -> float: return roll
	var room := RoomModel.new(PlayerProfile.sanitize(PROFILE, rng), rng)
	room.started.connect(func(setup: Dictionary) -> void: _started.append(setup))
	return room

func test_a_fresh_room_seats_the_host() -> void:
	var room := _room()
	assert_eq(room.mode, GameModes.DUEL)
	assert_eq(room.slots.size(), 2)
	assert_eq(room.slots[0]["name"], "PARITY7")
	assert_eq(room.slots[0]["kind"], "human")
	assert_null(room.slots[1])
	assert_false(room.can_start())

func test_bots_take_free_seats_and_are_ready() -> void:
	var room := _room()
	room.add_bot(1, "passive", "EX82R")
	assert_eq(room.slots[1]["name"], "EX82R")
	assert_eq(room.slots[1]["difficulty"], "passive")
	assert_true(room.is_ready(1), "a bot is auto-ready")
	assert_true(room.can_start())
	room.add_bot(0)
	assert_eq(room.slots[0]["kind"], "human", "an occupied seat stays as it is")
	room.set_bot_name(1, "  ")
	assert_eq(room.slots[1]["name"], "EX82R", "an empty name keeps the bot")
	room.set_bot_name(1, "RA-1")
	assert_eq(room.slots[1]["name"], "RA-1")
	assert_eq(room.slots[1]["difficulty"], "passive", "renaming keeps the difficulty")
	room.set_bot_difficulty(1, "normal")
	assert_eq(room.slots[1]["difficulty"], "normal")
	room.remove_bot(1)
	assert_null(room.slots[1])
	assert_false(room.is_ready(1))

func test_generated_bot_names() -> void:
	var room := _room()
	room.add_bot(1)
	assert_ne(str(room.slots[1]["name"]), "", "no name given: a generated model name")
	assert_eq(room.slots[1]["difficulty"], "normal")

func test_mode_switch_compacts_and_never_evicts() -> void:
	var room := _room()
	room.set_mode(GameModes.BATTLE)
	assert_eq(room.slots.size(), 4)
	room.add_bot(3, "normal", "B3")
	room.add_bot(2, "normal", "B2")
	room.set_mode(GameModes.WAR)
	assert_eq(room.slots[1]["name"], "B2", "seated players move onto the lowest seats in seat order")
	assert_eq(room.slots[2]["name"], "B3")
	assert_eq(room.slots[1]["id"], 1, "and take the seat ids")
	assert_true(room.is_ready(1) and room.is_ready(2), "readiness follows the seat")
	room.set_mode(GameModes.DUEL)
	assert_eq(room.mode, GameModes.WAR, "three seated players don't fit a duel: blocked")

func test_selection_resolves_when_a_bot_joins() -> void:
	var room := _room(SECOND_ROLL)
	room.set_map(ALL_MAPS)
	room.set_duration([3, 5])
	assert_eq(room.map_sel, ALL_MAPS)
	room.add_bot(1)
	assert_eq(room.map_id, "os_india", "a random pick from the host's selection (a bot accepts anything)")
	assert_eq(room.map_sel, ["os_india"], "the selection collapses to the pick")
	assert_eq(room.duration_min, 5)
	assert_eq(room.duration_sel, [5])

func test_ready_starts_once_every_seat_is_ready() -> void:
	var room := _room()
	room.set_map(["os_arena"])
	room.add_bot(1, "passive", "EX82R")
	assert_eq(_started.size(), 0, "the host is not ready yet")
	room.set_local_ready(true)
	assert_eq(_started.size(), 1)
	var setup: Dictionary = _started[0]
	assert_eq(setup["mode"], GameModes.DUEL)
	assert_eq(setup["map_id"], "os_arena")
	assert_eq(setup["duration_min"], RoomModel.DEFAULT_DURATION_MIN)
	assert_eq((setup["roster"] as Array).size(), 2)
	assert_eq(setup["teams"], {0: 0, 1: 1})
	room.set_local_ready(true)
	assert_eq(_started.size(), 1, "started once")
