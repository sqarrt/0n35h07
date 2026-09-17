extends GutTest
## Ball skin maths parity with web ClassicWindupFx / RageWindupFx / SingularityWindupFx (ball part), EchoRespawnFx,
## SpritePool + AfterimageTrail, DeathBurst and the ballArt texture layout.

const EPS := 0.001
const BASE := Color("#fa4")
const DT := 1.0 / 60.0

func _const(value: float) -> Callable:
	return func() -> float: return value

func test_shrink_follows_the_deflate_window() -> void:
	assert_almost_eq(SkinCurves.shrink(100.0), 0.5, EPS, "WINDUP_SHRINK_MS 200")
	assert_almost_eq(SkinCurves.shrink(400.0), 1.0, EPS)

func test_classic_windup_swells_and_whitens() -> void:
	var charging := SkinCurves.windup_ball("classic", 0.5, 1.0, BASE, 0.0)
	assert_almost_eq(charging["scale"], 1.2, EPS, "1 + 0.4 * progress")
	assert_eq(charging["color"], SkinCurves.lerp_linear(BASE, Color.WHITE, 0.5), "three.js lerps linear colours")
	var deflating := SkinCurves.windup_ball("classic", 0.0, 0.25, BASE, 0.0)
	assert_almost_eq(deflating["scale"], 1.3, EPS, "1 + 0.4 * (1 - shrink)")
	assert_eq(deflating["color"], BASE)
	var rest := SkinCurves.windup_ball("classic", 0.0, 1.0, BASE, 0.0)
	assert_almost_eq(rest["scale"], 1.0, EPS)
	assert_eq(rest["emission"], Color.BLACK)

func test_rage_and_singularity_ball_curves() -> void:
	var rage := SkinCurves.windup_ball("rage", 1.0, 1.0, BASE, 0.0)
	assert_almost_eq(rage["scale"], 1.25, EPS)
	assert_true((rage["color"] as Color).is_equal_approx(SkinCurves.RAGE_BODY_DARK), "fully charred at peak")
	var pulse_low := 1.0 - SkinCurves.RAGE_PULSE_DEPTH * 0.5   # sin(0) = 0
	assert_almost_eq((rage["emission"] as Color).r, SkinCurves.RAGE_EMISSIVE.srgb_to_linear().r * pulse_low, EPS)
	var sing := SkinCurves.windup_ball("singularity", 1.0, 1.0, BASE, 0.0)
	assert_almost_eq(sing["scale"], 0.65, EPS, "collapses by 35%")
	assert_true((sing["color"] as Color).is_equal_approx(SkinCurves.SING_DARK))

func test_echo_respawn_ghost_and_poof() -> void:
	var ghost := SkinCurves.echo_respawn(true, INF)
	assert_true(ghost["active"])
	assert_almost_eq(ghost["opacity"], 0.4, EPS, "GHOST_OPACITY")
	var poof := SkinCurves.echo_respawn(false, SkinCurves.SPAWN_ANIM_MS * 0.5)
	assert_almost_eq(poof["scale"], 1.25, EPS, "1 + SPAWN_POP * sin(pi/2)")
	assert_false(SkinCurves.echo_respawn(false, SkinCurves.SPAWN_ANIM_MS)["active"], "the poof lasts 280 ms")
	assert_false(SkinCurves.echo_respawn(false, -INF)["active"], "no poof before the first respawn (web -Infinity)")

func test_afterimage_trail_emits_every_16_ms_and_fades() -> void:
	var trail := AfterimageTrail.new(Color.WHITE)
	trail.update(DT, true, Vector3(0, 1.7, 0))
	assert_eq(trail.pool.alive_count(), 1, "first clone at once")
	assert_almost_eq(trail.pool.position(0).y, 1.4, EPS, "at the ball centre (eye + BODY_MESH_Y)")
	trail.update(DT, true, Vector3(1, 1.7, 0))
	assert_eq(trail.pool.alive_count(), 2)
	var older := trail.pool.opacity(0)
	assert_lt(older, SkinCurves.DASH_TRAIL_OPACITY, "clones fade with life")
	for i in 30:
		trail.update(DT, false, Vector3.ZERO)
	assert_eq(trail.pool.alive_count(), 0, "260 ms life")

func test_death_burst_scatters_falls_and_shrinks() -> void:
	var burst := DeathBurst.new(Color.WHITE)
	burst.emit(Vector3.ZERO, _const(1.0))
	assert_eq(burst.pool.alive_count(), SkinCurves.DEATH_BURST_COUNT)
	burst.update(0.1)
	var p := burst.pool.position(0)
	assert_gt(p.x, 0.0, "random 1 -> outward +x")
	assert_almost_eq(burst.pool.opacity(0), 0.9 * 0.75, EPS, "opacity 0.9 * life share")
	assert_almost_eq(burst.pool.scale(0), 0.75, EPS)
	burst.update(0.4)
	assert_eq(burst.pool.alive_count(), 0, "400 ms life")

func test_ball_art_texture_layout_matches_the_web() -> void:
	var raw := PackedByteArray()
	raw.resize(AppearanceConst.BALL_ART_BYTES)
	raw[0] = 1                                            # front cell (0, 0): top-left of the editor grid
	raw[BallArt.BYTES_PER_SIDE] = 2                       # back cell (1, 0)
	var data := BallArt.texture_bytes(Marshalls.raw_to_base64(raw))
	assert_eq(data.size(), BallArt.TEX_W * BallArt.TEX_H)
	var top_row := BallArt.SIZE - 1                        # editor top row -> the last texture row (web flip)
	assert_eq(data[top_row * BallArt.TEX_W + 0], 0, "painted front cell is a black multiplier")
	assert_eq(data[top_row * BallArt.TEX_W + BallArt.SIZE + 1], 0, "painted back cell")
	assert_eq(data[0], 255, "empty cells stay white")
	assert_eq(BallArt.texture_bytes("").size(), BallArt.TEX_W * BallArt.TEX_H, "no art -> all white")
