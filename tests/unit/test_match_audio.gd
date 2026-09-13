extends GutTest
## Match sound wiring: the SFX engine gets the arena as its world, combat events are re-emitted by the match, streak
## announces sound, GO starts the seeded match music on the profile level, and the end fades it with the tail.

const DT := 1.0 / 60.0

func _match_audio(world: Node3D) -> Array:
	var match_node := MatchNode.new()
	add_child_autofree(match_node)
	var audio := MatchAudio.new()
	audio.seed_code = "K7Q2X"
	add_child_autofree(audio)
	audio.setup(match_node, [], 0, world)
	return [match_node, audio]

func test_the_match_re_emits_every_rule_event() -> void:
	var match_node := MatchNode.new()
	add_child_autofree(match_node)
	var received := []
	match_node.combat_event.connect(func(event: Dictionary) -> void: received.append(event["t"]))
	match_node.emit_events([{"t": "respawn", "id": 1, "pos": Vector3.ZERO}, {"t": "fired", "id": 0}])
	assert_eq(received, ["respawn", "fired"])

func test_go_starts_the_music_and_the_end_fades_it() -> void:
	var world := Node3D.new()
	add_child_autofree(world)
	var parts := _match_audio(world)
	var match_node: MatchNode = parts[0]
	var audio: MatchAudio = parts[1]
	var sources := Audio.analysis.source_count()
	assert_eq(Audio.sfx().world_parent, world, "positional sounds live in the arena")
	assert_null(audio.music(), "silent through the countdown")
	match_node.force_live()
	audio._physics_process(DT)
	assert_not_null(audio.music())
	assert_true(audio.music().is_started(), "GO starts the match music")
	assert_eq(Audio.analysis.source_count(), sources + 1, "the match music feeds the visualiser")
	match_node.phase.end()
	audio._physics_process(DT)
	var master := AudioServer.get_bus_index(MatchAudio.MUSIC_BUS)
	assert_true(AudioServer.is_bus_effect_enabled(master, MusicEngine.EFFECT_TAIL), "faded out with the tail echo")
	audio.free()
	assert_eq(Audio.analysis.source_count(), sources, "leaving the arena drops the music from the analysis")

func test_streak_announces_play_their_sound() -> void:
	var world := Node3D.new()
	add_child_autofree(world)
	var parts := _match_audio(world)
	var match_node: MatchNode = parts[0]
	var before := Audio.sfx().get_child_count()
	match_node.frag.emit(0, 1, Streak.STREAK_DOUBLE, false)
	assert_eq(Audio.sfx().get_child_count(), before + 1, "double kill")
