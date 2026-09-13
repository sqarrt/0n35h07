extends GutTest
## Respawn skin timing parity with web ChaosRespawnFx (jitter / tear / flicker / stepped reassembly) and SwarmRespawnFx
## (scatter, orbit capture, clone trail, gather and ignition).

const EPS := 0.001

func _const(value: float) -> Callable:
	return func() -> float: return value

func test_chaos_tears_then_jitters_and_flickers() -> void:
	var chaos := ChaosRespawn.new()
	chaos.on_death()
	var tear := chaos.ghost_frame(0.016, 1.0, _const(1.0))
	var tear_amp := ChaosRespawn.JITTER_MAX * ChaosRespawn.BREAK_AMP
	assert_true((tear["offset"] as Vector3).is_equal_approx(Vector3.ONE * tear_amp), "amplified for the first 250 ms")
	assert_almost_eq(tear["opacity"], ChaosRespawn.GHOST_OPACITY_HI, EPS, "no drop on a high roll")
	var calm := ChaosRespawn.new()
	var frame := calm.ghost_frame(0.016, 0.5, _const(0.0))
	assert_almost_eq((frame["offset"] as Vector3).x, -ChaosRespawn.JITTER_MAX, EPS)
	assert_almost_eq(frame["opacity"], ChaosRespawn.GHOST_OPACITY_LO, EPS, "chance hit -> the low flicker")

func test_chaos_reassembles_in_four_steps() -> void:
	var chaos := ChaosRespawn.new()
	chaos.ghost_frame(0.016, 0.5, _const(1.0))
	var half := chaos.rebirth_frame(ChaosRespawn.REBIRTH_MS * 0.5)
	assert_almost_eq(half["opacity"], 0.8, EPS, "step 2 of 4: 0.4 + 0.6 * 2/3")
	assert_true((half["offset"] as Vector3).is_equal_approx(chaos.jitter * 0.5), "the offset decays")
	assert_almost_eq(chaos.rebirth_frame(0.0)["opacity"], ChaosRespawn.REBIRTH_OPACITY_FROM, EPS)
	assert_false(ChaosRespawn.is_rebirth(ChaosRespawn.REBIRTH_MS))

func test_swarm_scatters_orbits_and_gathers() -> void:
	var swarm := SwarmRespawn.new(_const(0.5))
	swarm.on_death(Vector3.ZERO, _const(1.0))
	swarm.ghost_step(SwarmRespawn.SCATTER_MS / 1000.0, Vector3.ZERO, _const(0.0))
	assert_true(swarm.world_visible)
	assert_true(swarm.trail_alive(0), "the first clone right away")
	for i in 30:
		swarm.ghost_step(0.016, Vector3.ZERO, _const(0.0))
	var distance := Vector2(swarm.positions[0].x, swarm.positions[0].z).length()
	assert_almost_eq(distance, SwarmRespawn.ORBIT_R_MIN + 0.5 * (SwarmRespawn.ORBIT_R_MAX - SwarmRespawn.ORBIT_R_MIN), 0.2,
		"captured near its orbit radius")
	var scale := swarm.rebirth_step(SwarmRespawn.GATHER_MS * 0.5, Vector3.ZERO)
	assert_almost_eq(scale, 0.875, EPS, "0.5 + 0.5 * (1 - (1 - 0.5)^2)")
	swarm.rebirth_step(SwarmRespawn.GATHER_MS, Vector3.ZERO)
	assert_false(swarm.world_visible, "gone when the gather ends")
	swarm.update_trail(1.0)
	assert_false(swarm.trail_alive(0), "clones fade outside the phases too")
