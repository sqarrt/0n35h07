extends GutTest

func test_beam_shows_then_hides_after_duration() -> void:
	var fx := BeamFx.new()
	add_child_autofree(fx)
	fx.play(Vector3(0, 1, 0), Vector3(0, 1, -5))
	assert_true(fx.is_beam_visible(), "beam visible right after play")
	var elapsed := 0.0
	while elapsed < (CombatConst.BEAM_DURATION_MS + 40.0) / 1000.0:
		fx.update_fx(1.0 / 60.0)
		elapsed += 1.0 / 60.0
	assert_false(fx.is_beam_visible(), "beam hidden after BEAM_DURATION")

func test_impact_spawns_live_particles() -> void:
	var fx := BeamFx.new()
	add_child_autofree(fx)
	fx.spawn_impact(Vector3(0, 1, -5))
	assert_gt(fx.alive_particles(), 0, "impact spawns particles")
