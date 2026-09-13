extends GutTest
## Windup world parts parity with web RageWindupFx (the jaw hologram) and SingularityWindupFx (vortex + flash).

const EPS := 0.001

func _const(value: float) -> Callable:
	return func() -> float: return value

func test_jaw_teeth_form_a_horseshoe() -> void:
	var edge := RageJaws.tooth(true, 0)
	assert_almost_eq((edge["position"] as Vector3).x, -RageJaws.WIDTH * 0.5, EPS, "first tooth at the left edge")
	assert_almost_eq((edge["position"] as Vector3).y, RageJaws.GAP * 0.5, EPS, "edges carry no arch")
	assert_almost_eq((edge["position"] as Vector3).z, 0.0, EPS, "edges set back")
	assert_almost_eq(edge["yaw"], RageJaws.EDGE_YAW, EPS, "edge teeth turned along the arc")
	assert_lt(edge["length"], 0.0, "upper teeth point down")
	var middle := RageJaws.tooth(false, 2)
	assert_gt((middle["position"] as Vector3).z, 0.0, "the centre pushes forward along the aim")
	assert_lt((middle["position"] as Vector3).y, 0.0, "lower jaw below")
	assert_gt(middle["length"], 0.0, "lower teeth point up")
	assert_almost_eq(RageJaws.tooth_variation(0), 1.0 - RageJaws.TOOTH_LEN_VAR * 0.5, EPS, "sin(0) = 0")

func test_mouth_opens_with_the_charge_and_snaps_shut() -> void:
	assert_almost_eq(RageJaws.open_amount(0.5, 1.0), 0.5, EPS)
	assert_almost_eq(RageJaws.open_amount(0.0, 0.15), 0.5, EPS, "half shut halfway through the 30% snap")
	assert_almost_eq(RageJaws.open_amount(0.0, 0.3), 0.0, EPS)
	assert_almost_eq(RageJaws.appear(0.075, 1.0), 0.5, EPS, "fades in over 15% of the charge")
	assert_almost_eq(RageJaws.appear(0.0, 0.25), 0.75, EPS, "dissolves with the deflate")
	assert_false(RageJaws.active(0.0, 1.0))

func test_glitch_waits_a_full_interval_then_jerks() -> void:
	var jaws := RageJaws.new()
	assert_false(jaws.step_glitch(0.1, _const(0.0)), "never on the first frames")
	assert_true(jaws.step_glitch(0.07, _const(0.0)), "coin flip at 160 ms: chance hit")
	assert_true(jaws.glitch_offset.is_equal_approx(Vector3(-RageJaws.GLITCH_SHIFT, -RageJaws.GLITCH_SHIFT * 0.5, 0.0)))
	assert_almost_eq(RageJaws.opacity(1.0, true), RageJaws.OPACITY * RageJaws.GLITCH_OPACITY_DROP, EPS)

func test_vortex_spirals_in_and_reborn_at_the_rim() -> void:
	var vortex := SingularityVortex.new(_const(0.0))
	assert_almost_eq(vortex.radius(0), SingularityVortex.R_MIN, EPS, "random 0 -> the inner radius")
	vortex.step(0.01, 1.0, _const(0.5))
	assert_almost_eq(vortex.radius(0), SingularityVortex.R_MAX, EPS, "absorbed -> reborn at R_MAX")
	var before := vortex.radius(0)
	vortex.step(0.1, 1.0, _const(0.5))
	assert_almost_eq(vortex.radius(0), before - SingularityVortex.PULL * SingularityVortex.R_MAX * 0.1, EPS)
	assert_almost_eq(SingularityVortex.vortex_opacity(0.1), 0.45, EPS, "fades in over 20% of the charge")
	var flash := SingularityVortex.flash(0.225)
	assert_true(flash["visible"])
	assert_almost_eq(flash["scale"], 1.8, EPS)
	assert_almost_eq(flash["opacity"], 0.4, EPS)
	assert_false(SingularityVortex.flash(0.5)["visible"], "over after 45% of the deflate")
