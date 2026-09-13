extends GutTest
## OVERHEAT HUD node parity with web OverheatVignette: shown per tier with its inset shadow, bolts re-created on a tier
## change while the pulse keeps running, strikes on each bolt's own clock, hidden outside a streak.

const EPS := 0.001
const SCREEN := Vector2i(1280, 720)
const HALF_ROLL := 0.5

func _const(value: float) -> Callable:
	return func() -> float: return value

func _vignette() -> HudOverheatVignette:
	var viewport := SubViewport.new()
	viewport.size = SCREEN
	add_child_autofree(viewport)
	var node := HudOverheatVignette.new()
	node.rng = _const(HALF_ROLL)
	viewport.add_child(node)
	return node

func test_a_tier_shows_the_edges_and_its_bolts() -> void:
	var node := _vignette()
	assert_false(node.visible, "hidden without a streak")
	node.set_tier("triple")
	assert_true(node.visible)
	assert_eq(node.bolt_count(), 12)
	assert_gt(node.stroke_count(), 0)
	var edges := node.vignette().material as ShaderMaterial
	assert_almost_eq(edges.get_shader_parameter("glow_px"), 58.0, EPS)
	assert_almost_eq(edges.get_shader_parameter("glow_spread_px"), 58.0 * OverheatFx.SPREAD_SHARE, EPS)
	assert_almost_eq(node.vignette().modulate.a, 0.8, EPS, "ov-pulse starts at 0.8")
	node.set_tier("")
	assert_false(node.visible)

func test_bolts_strike_on_their_own_clock() -> void:
	var node := _vignette()
	node.set_tier("double")
	assert_true(Array(node.bolt_opacities()).all(func(o: float) -> bool: return o == 0.0), "all waiting for a delay")
	var dur: float = (OverheatFx.TIERS["double"]["dmin"] + OverheatFx.TIERS["double"]["dmax"]) * HALF_ROLL
	node.tick(dur * HALF_ROLL + dur * 0.04)
	assert_almost_eq(node.bolt_opacities()[0], 1.0, EPS, "4% into the strike")

func test_a_fixture_holds_given_bolts_at_their_peak() -> void:
	var node := _vignette()
	var bolt := {"side": OverheatFx.SIDE_LEFT, "top_pct": 50.0, "length": 30.0,
		"segments": [{"from": Vector2(0.0, 17.0), "to": Vector2(30.0, 17.0), "width": OverheatFx.STROKE_WIDTH}]}
	node.show_fixture("double", [bolt])
	node.tick(1.0)
	assert_eq(node.bolt_count(), 1)
	assert_eq(node.stroke_count(), 1)
	assert_almost_eq(node.bolt_opacities()[0], 1.0, EPS, "held at the strike peak")
	assert_almost_eq(node.vignette().modulate.a, 0.8, EPS, "held at the pulse start")

func test_a_new_tier_restarts_the_bolts_but_not_the_pulse() -> void:
	var node := _vignette()
	node.set_tier("double")
	node.tick(1.0)
	node.set_tier("triple")
	assert_eq(node.bolt_count(), 12)
	assert_true(Array(node.bolt_opacities()).all(func(o: float) -> bool: return o == 0.0), "fresh bolts wait again")
	node.tick(0.0)
	assert_almost_eq(node.vignette().modulate.a, OverheatFx.pulse_opacity(1.0, OverheatFx.TIERS["triple"]["pulse"]), EPS)
