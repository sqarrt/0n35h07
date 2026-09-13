extends GutTest
## Dash trail and shield skin timing parity with web WaveTrail, RiftTrail, DomeShieldFx, HexShieldFx, CrystalShieldFx.

const EPS := 0.001
const STEP_S := 0.025

func test_wave_rings_face_the_motion_grow_and_fade() -> void:
	var wave := WaveTrail.new()
	wave.update(STEP_S, true, Vector3.ZERO)
	wave.update(STEP_S, true, Vector3(1, 0, 0))
	assert_eq(wave.alive_count(), 2, "a ring every 25 ms")
	assert_true(wave.normals[1].is_equal_approx(Vector3.RIGHT), "ring plane across the motion")
	assert_almost_eq(wave.positions[1].y, SkinCurves.BODY_MESH_Y, EPS, "at the ball centre")
	assert_almost_eq(wave.scale(1), 1.0 + WaveTrail.GROW * STEP_S, EPS)
	assert_almost_eq(wave.opacity(1), WaveTrail.OPACITY * (1.0 - STEP_S * 1000.0 / WaveTrail.LIFE_MS), EPS)
	for i in 20:
		wave.update(STEP_S, false, Vector3(1, 0, 0))
	assert_eq(wave.alive_count(), 0, "450 ms life")

func test_rift_triplets_split_rgb_across_the_motion_and_flicker() -> void:
	var rift := RiftTrail.new()
	rift.update(STEP_S, true, Vector3.ZERO)
	rift.update(0.05, true, Vector3(1, 0, 0))
	assert_eq(rift.alive_count(), 2)
	var red := rift.channel_position(1, 0)
	assert_almost_eq(red.z, RiftTrail.OFFSET, EPS, "red copy +0.12 along motion x UP")
	assert_almost_eq(rift.channel_position(1, 2).z, -RiftTrail.OFFSET, EPS, "blue on the other side")
	var bright := rift.opacity(1)
	rift.update(0.05, false, Vector3(1, 0, 0))   # flicker clock 125 ms: the dim phase
	assert_lt(rift.opacity(1), bright * RiftTrail.FLICKER_DIM + EPS)

func test_dome_pulses_fill_and_wire_together() -> void:
	var dome := ShieldSkinState.new("dome")
	dome.update(PI / (2.0 * ShieldSkinState.DOME_PULSE_RATE) / 1000.0, true)
	assert_almost_eq(dome.dome_fill_opacity(), 0.18, EPS, "peak: 0.08 + 0.1")
	assert_almost_eq(dome.dome_wire_opacity(), 0.6, EPS)

func test_hex_wave_flashes_top_to_bottom_then_shimmers() -> void:
	assert_eq(ShieldSkinState.HEX_TILES, 36)
	assert_almost_eq(ShieldSkinState.hex_tile_direction(0).length(), 1.0, EPS)
	assert_lt(ShieldSkinState.hex_tile_delay(0), ShieldSkinState.hex_tile_delay(35), "top tiles flash first")
	var hex := ShieldSkinState.new("hex")
	hex.update(ShieldSkinState.hex_tile_delay(0) / 1000.0, true)
	assert_gt(hex.hex_tile_opacity(0), 0.7, "tile 0 at its flash peak")
	hex.update(1.0, true)
	var idle := hex.hex_tile_opacity(5)
	assert_almost_eq(idle, 0.18, 0.061, "base 0.18 +- shimmer 0.06")
	hex.update(0.1, false)
	hex.update(ShieldSkinState.hex_tile_delay(0) / 1000.0, true)   # the new wave reaches tile 0 after its delay
	assert_gt(hex.hex_tile_opacity(0), 0.7, "a new activation restarts the wave")

func test_crystal_face_hops_in_steps_of_seven() -> void:
	var crystal := ShieldSkinState.new("crystal")
	assert_eq(crystal.crystal_lit_face(), 0)
	crystal.update(0.14, true)
	assert_eq(crystal.crystal_lit_face(), 7)
	crystal.update(0.28, true)
	assert_eq(crystal.crystal_lit_face(), 1, "(3 x 7) mod 20")
	crystal.update(1.0, false)
	assert_eq(crystal.crystal_lit_face(), 1, "the clock stops while the shield is down")
