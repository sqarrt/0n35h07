extends GutTest
## Music engine wiring: buses per engine, loop 0 sounding on its slots, the next loop requested ahead of its bar and
## applied on it, the tail echo enabled on fade-out and the buses removed with the engine.

const PREFIX := "TestMusic"
const MANIFEST := "res://assets/audio/music/manifest.json"
const EPS := 0.001
const FRAME_S := 1.0 / 60.0

var _library := {}
var _calls: Array = []

func before_all() -> void:
	_library = JSON.parse_string(FileAccess.get_file_as_string(MANIFEST))["roles"]

func _voices(loop: int) -> Array:
	_calls.append(loop)
	var kicks: Array = _library["kicks"]
	return [{"role": "kicks", "stem_id": kicks[loop % kicks.size()], "gain": 1.0},
		{"role": "lead", "stem_id": _library["lead"][0], "gain": 0.32, "double_sec": 0.05}]

func _engine() -> MusicEngine:
	_calls.clear()
	var engine := MusicEngine.new()
	engine.bus_prefix = PREFIX
	engine.setup(_voices)
	add_child(engine)
	engine.start()
	return engine

func test_loop_zero_plays_on_its_slots_through_the_engine_buses() -> void:
	var engine := _engine()
	assert_ne(AudioServer.get_bus_index(PREFIX), -1, "engine bus")
	assert_eq(AudioServer.get_bus_send(AudioServer.get_bus_index(engine.slot_bus(MusicSlots.SLOT_KICKS))), PREFIX)
	assert_eq(_calls, [0], "loop 0 arranged before playback")
	assert_true(engine.active_stem_ids().has(_library["kicks"][0]))
	assert_true(engine.active_stem_ids().has(_library["lead"][0]))
	var bus := AudioServer.get_bus_index(engine.slot_bus(MusicSlots.SLOT_DOUBLE))
	assert_true(AudioServer.is_bus_effect_enabled(bus, MusicEngine.EFFECT_COPY_DELAY), "the doubled copy is delayed")
	assert_not_null(engine.capture(), "a capture for the AudioBar")
	engine.free()
	assert_eq(AudioServer.get_bus_index(PREFIX), -1, "buses leave with the engine")

func test_the_next_loop_is_requested_ahead_and_applied_on_its_bar() -> void:
	var engine := _engine()
	engine.step(5.9, FRAME_S)
	assert_eq(_calls, [0])
	engine.step(6.0, FRAME_S)
	assert_eq(_calls, [0, 1], "requested 2 s before the bar")
	assert_eq(engine.loop_index(), 0)
	engine.step(8.0, FRAME_S)
	assert_eq(engine.loop_index(), 1, "applied on the bar")
	assert_true(engine.active_stem_ids().has(_library["kicks"][1]))
	engine.free()

func test_fade_out_stops_scheduling_and_rings_the_tail() -> void:
	var engine := _engine()
	engine.fade_out()
	var master := AudioServer.get_bus_index(PREFIX)
	assert_true(AudioServer.is_bus_effect_enabled(master, MusicEngine.EFFECT_TAIL))
	engine.step(6.0, MusicEngine.END_FADE_SEC)
	assert_eq(_calls, [0], "no new loops after the fade-out")
	var amplify := AudioServer.get_bus_effect(master, MusicEngine.EFFECT_AMPLIFY) as AudioEffectAmplify
	assert_almost_eq(amplify.volume_db, linear_to_db(MusicEngine.MIN_LINEAR), EPS, "faded to silence")
	engine.free()
