extends GutTest
## Match SFX rule parity with web MatchSfx / windupSfx: whole-shot windup sounds by style, shield loops, dash, throttled
## landings, cooldown-ready for the local player, 2D for your own player and positional for others, combat events.

const NOW_MS := 1000.0
const LOCAL_ID := 0
const REMOTE_ID := 1
const REMOTE_POS := Vector3(3.0, 1.0, -4.0)

class FakeEngine:
	var calls: Array = []
	var loaded := {}
	func play_at(event: String, pos: Vector3, _gain := 1.0) -> void:
		calls.append(["at", event, pos])
	func play_2d(event: String, _gain := 1.0) -> void:
		calls.append(["2d", event])
	func has(event: String) -> bool:
		return loaded.get(event, true)
	func start_loop(event: String, key: String, target) -> void:
		calls.append(["loop", event, key, target])
	func stop_loop(key: String) -> void:
		calls.append(["stop", key])

func _frame_input(id: int, changes := {}) -> Dictionary:
	var input := {"id": id, "target": null, "pos": REMOTE_POS, "shield_active": false, "dashing": false,
		"grounded": true, "just_jumped": false, "dash_ready": null, "shield_ready": null, "winding_up": false,
		"windup_style": "classic", "is_local": id == LOCAL_ID}
	input.merge(changes, true)
	return input

func test_windup_plays_its_style_once_with_a_fallback() -> void:
	var engine := FakeEngine.new()
	var sfx := MatchSfx.new(engine)
	sfx.frame([_frame_input(LOCAL_ID)], NOW_MS)
	sfx.frame([_frame_input(LOCAL_ID, {"winding_up": true, "windup_style": "rage"})], NOW_MS)
	sfx.frame([_frame_input(LOCAL_ID, {"winding_up": true, "windup_style": "rage"})], NOW_MS)
	assert_eq(engine.calls, [["2d", "beam_fire_rage"]], "once, from the windup start, 2D for your own player")
	engine.loaded["beam_fire_singularity"] = false
	assert_eq(MatchSfx.windup_event("singularity", engine), "beam_fire", "missing asset -> the classic beam")

func test_remote_shield_is_positional_with_a_loop_on_its_body() -> void:
	var engine := FakeEngine.new()
	var sfx := MatchSfx.new(engine)
	var body := Node3D.new()
	autofree(body)
	sfx.frame([_frame_input(REMOTE_ID, {"target": body})], NOW_MS)
	sfx.frame([_frame_input(REMOTE_ID, {"target": body, "shield_active": true, "dashing": true})], NOW_MS)
	sfx.frame([_frame_input(REMOTE_ID, {"target": body})], NOW_MS)
	assert_eq(engine.calls, [["at", "shield_up", REMOTE_POS], ["loop", "shield_loop", "shield:1", body],
		["at", "dash", REMOTE_POS], ["at", "shield_down", REMOTE_POS], ["stop", "shield:1"]])

func test_landings_are_throttled_and_returned_as_moves() -> void:
	var engine := FakeEngine.new()
	var sfx := MatchSfx.new(engine)
	sfx.frame([_frame_input(REMOTE_ID, {"grounded": false})], NOW_MS)
	var moves := sfx.frame([_frame_input(REMOTE_ID)], NOW_MS)
	assert_eq(moves.size(), 1)
	sfx.frame([_frame_input(REMOTE_ID, {"grounded": false})], NOW_MS + 16.0)
	assert_eq(sfx.frame([_frame_input(REMOTE_ID)], NOW_MS + 32.0).size(), 0, "a bhop bounce 32 ms later stays silent")
	sfx.frame([_frame_input(REMOTE_ID, {"grounded": null})], NOW_MS + 500.0)
	assert_eq(sfx.frame([_frame_input(REMOTE_ID)], NOW_MS + 600.0).size(), 0, "unknown -> grounded is not a landing")

func test_cooldown_ready_for_the_local_player() -> void:
	var engine := FakeEngine.new()
	var sfx := MatchSfx.new(engine)
	sfx.frame([_frame_input(LOCAL_ID, {"dash_ready": false, "shield_ready": true})], NOW_MS)
	sfx.frame([_frame_input(LOCAL_ID, {"dash_ready": true, "shield_ready": true})], NOW_MS)
	assert_eq(engine.calls, [["2d", "cooldown_ready"]])

func test_combat_events_and_reset() -> void:
	var engine := FakeEngine.new()
	var sfx := MatchSfx.new(engine)
	var positions := {REMOTE_ID: REMOTE_POS}
	var pos_of := func(id: int): return positions.get(id)
	sfx.combat({"t": "block", "shooter": LOCAL_ID, "victim": REMOTE_ID}, pos_of)
	sfx.combat({"t": "kill", "shooter": LOCAL_ID, "victim": 7}, pos_of)
	sfx.combat({"t": "respawn", "id": REMOTE_ID, "pos": Vector3.UP}, pos_of)
	assert_eq(engine.calls, [["at", "block", REMOTE_POS], ["at", "respawn", Vector3.UP]], "unknown victim: silent")
	sfx.frame([_frame_input(LOCAL_ID)], NOW_MS)
	engine.calls.clear()
	sfx.reset()
	assert_eq(engine.calls, [["stop", "shield:0"]])
