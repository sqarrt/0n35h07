extends GutTest
## SFX engine parity with web ThreeSfxEngine: per-event gains on the SFX bus, positional sounds on the web
## inverse-distance model, keyed loops (2D for your own player, riding on a target otherwise) and the master level.

const BUS := "TestSfx"
const EPS := 0.001
const POS := Vector3(1.0, 2.0, 3.0)

func _engine() -> SfxEngine:
	var engine := SfxEngine.new()
	engine.bus_name = BUS
	add_child_autofree(engine)
	return engine

func _players(parent: Node, type: String) -> Array:
	return parent.get_children().filter(func(n: Node) -> bool: return n.is_class(type))

func test_a_2d_one_shot_uses_the_event_gain_on_the_sfx_bus() -> void:
	var engine := _engine()
	assert_true(engine.has("ui_click"))
	assert_false(engine.has("nope"))
	engine.play_2d("nope")
	assert_eq(_players(engine, "AudioStreamPlayer").size(), 0, "unknown events are silent")
	engine.play_2d("ui_click")
	var player: AudioStreamPlayer = _players(engine, "AudioStreamPlayer")[0]
	assert_eq(player.bus, BUS)
	assert_almost_eq(player.volume_db, linear_to_db(0.4), EPS)
	assert_not_null(engine.capture(), "the AudioBar taps this bus")

func test_a_positional_one_shot_follows_the_web_distance_model() -> void:
	var engine := _engine()
	var world := Node3D.new()
	add_child_autofree(world)
	engine.world_parent = world
	engine.play_at("block", POS)
	var player: AudioStreamPlayer3D = _players(world, "AudioStreamPlayer3D")[0]
	assert_eq(player.attenuation_model, AudioStreamPlayer3D.ATTENUATION_INVERSE_DISTANCE)
	assert_almost_eq(player.unit_size, SfxEngine.REF_DISTANCE, EPS)
	assert_almost_eq(player.max_db, SfxEngine.MAX_DB, EPS)
	assert_eq(player.global_position, POS)
	assert_almost_eq(player.volume_db, linear_to_db(0.9), EPS)

func test_loops_are_keyed_and_ride_on_their_target() -> void:
	var engine := _engine()
	var body := Node3D.new()
	add_child_autofree(body)
	engine.start_loop("shield_loop", "shield:0", null)
	engine.start_loop("shield_loop", "shield:0", null)
	engine.start_loop("shield_loop", "shield:1", body)
	assert_eq(engine.loop_count(), 2, "one loop per key")
	assert_eq(_players(body, "AudioStreamPlayer3D").size(), 1, "the remote shield hums on its body")
	engine.stop_loop("shield:1")
	assert_eq(engine.loop_count(), 1)
	assert_true(_players(body, "AudioStreamPlayer3D")[0].is_queued_for_deletion())

func test_the_user_level_scales_the_master_gain() -> void:
	var engine := _engine()
	engine.set_user_gain(0.5)
	var amplify := AudioBuses.effect(BUS, SfxEngine.EFFECT_AMPLIFY) as AudioEffectAmplify
	assert_almost_eq(amplify.volume_db, linear_to_db(SfxEngine.MASTER_GAIN * 0.5), EPS)
