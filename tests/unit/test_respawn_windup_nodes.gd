extends GutTest
## Windup world and respawn skin nodes parity with web createWindupFx / createRespawnFx: the parts each style builds,
## the jaws in front of the ball, the vortex and flash, and who owns the ball during the ghost and rebirth windows.

const PLAYER := preload("res://scenes/player.tscn")
const EPS := 0.001
const DT := 1.0 / 60.0
const ORIGIN := Vector3(1.0, 2.0, 3.0)
const AIM_DOWN_FORWARD := Vector3(0.0, -0.5, -1.0)
const HALF_CHARGE := 0.5
const NO_DEFLATE := 1.0
const SPAWN := Vector3(0.7, 1.0, 20.0)

func _const(value: float) -> Callable:
	return func() -> float: return value

func _player(respawn_style: String, windup_style := "classic") -> PlayerNode:
	var p: PlayerNode = PLAYER.instantiate()
	p.get_node("Camera3D").free()
	p.player.body.position = SPAWN   # away from the origin, like a real spawn
	add_child_autofree(p)
	p.apply_appearance({"id": 1, "name": "PARITY7", "color": "#fa4", "windupStyle": windup_style,
		"respawnStyle": respawn_style})
	return p

func _windup(style: String, rng: Callable) -> WindupWorldView:
	var view := WindupWorldView.new()
	add_child_autofree(view)
	view.setup(style, rng)
	return view

func test_rage_jaws_hang_in_front_along_the_flat_aim() -> void:
	var view := _windup(WindupWorldView.STYLE_RAGE, _const(1.0))
	assert_eq(view.teeth().size(), RageJaws.TEETH * 2)
	view.apply(DT, HALF_CHARGE, NO_DEFLATE, ORIGIN, AIM_DOWN_FORWARD, true, _const(1.0))
	assert_true(view.visible)
	var jaw := view.teeth()[0].get_parent() as Node3D
	var root := jaw.get_parent() as Node3D
	assert_true(root.global_position.is_equal_approx(ORIGIN + Vector3(0, 0, -RageJaws.DISTANCE)), "flat aim, no glitch")
	assert_almost_eq(jaw.position.y, HALF_CHARGE * RageJaws.OPEN_DIST, EPS, "the upper jaw opens with the charge")
	assert_lt(view.teeth()[2].global_position.z, root.global_position.z, "the horseshoe centre pushes along the aim")
	assert_almost_eq(view.teeth()[0].get_instance_shader_parameter("opacity"), RageJaws.OPACITY, EPS, "fully faded in")
	view.apply(DT, HALF_CHARGE, NO_DEFLATE, ORIGIN, AIM_DOWN_FORWARD, false, _const(1.0))
	assert_false(view.visible, "no world part for your own first-person body")

func test_singularity_vortex_then_collapse_flash() -> void:
	var view := _windup(WindupWorldView.STYLE_SINGULARITY, _const(0.5))
	view.apply(DT, HALF_CHARGE, NO_DEFLATE, ORIGIN, Vector3.FORWARD, true, _const(0.5))
	assert_true(view.points().visible)
	assert_false(view.flash().visible)
	assert_eq(view.points().mesh.surface_get_array_len(0), SingularityVortex.PARTICLES, "one point per particle")
	view.apply(DT, 0.0, SingularityVortex.FLASH_FRAC * 0.5, ORIGIN, Vector3.FORWARD, true, _const(0.5))
	assert_false(view.points().visible)
	assert_true(view.flash().visible)
	assert_almost_eq(view.flash().global_transform.basis.get_scale().x, 1.8, EPS, "halfway to FLASH_SCALE")
	view.apply(DT, 0.0, NO_DEFLATE, ORIGIN, Vector3.FORWARD, true, _const(0.5))
	assert_false(view.visible)
	view.setup("classic", _const(0.5))
	assert_eq(view.get_child_count(), 0, "classic has no world part")

func test_player_hides_the_windup_world_part_while_a_ghost() -> void:
	var p := _player(RespawnFxView.STYLE_ECHO, WindupWorldView.STYLE_RAGE)
	assert_eq(p.windup_world().style(), WindupWorldView.STYLE_RAGE)
	assert_eq(p.windup_world().global_transform, Transform3D.IDENTITY, "world-space parts ignore the player's offset")
	assert_eq(p.respawn_fx().global_transform, Transform3D.IDENTITY)
	p.player.respawning = true
	p.update_visuals(DT)
	assert_false(p.windup_world().visible)

func test_chaos_ghost_jitters_the_ball_then_reassembles() -> void:
	var p := _player(RespawnFxView.STYLE_CHAOS)
	assert_null(p.burst_view(), "chaos has no particle burst")
	assert_not_null(p.ghost_trail_view(), "but its own ghost trail")
	p.player.respawning = true
	p.player.respawn_timer = MatchConst.RESPAWN_GHOST_MS
	p.update_visuals(DT)
	var mesh := p.ball_visual().ball()
	assert_gt(mesh.position.length(), 0.0, "the mesh tears away from its place")
	var opacity := 1.0 - mesh.transparency
	assert_true(is_equal_approx(opacity, ChaosRespawn.GHOST_OPACITY_HI) or is_equal_approx(opacity, ChaosRespawn.GHOST_OPACITY_LO))
	p.player.respawning = false
	p.update_visuals(DT)   # the materialisation edge starts the rebirth clock
	assert_almost_eq(mesh.transparency, 1.0 - ChaosRespawn.REBIRTH_OPACITY_FROM, EPS, "the first reassembly step")
	p.update_visuals(ChaosRespawn.REBIRTH_MS / SkinCurves.MS_PER_S)
	assert_true(mesh.position.is_zero_approx(), "neutral restore")
	assert_almost_eq(mesh.transparency, 0.0, EPS)

func test_swarm_replaces_the_ball_then_gathers_back() -> void:
	var p := _player(RespawnFxView.STYLE_SWARM)
	var fx := p.respawn_fx()
	p.player.respawning = true
	p.update_visuals(DT)
	assert_false(p.ball_visual().ball().visible, "the swarm marks the player")
	assert_eq(fx.fragments_visible_count(), SwarmRespawn.FRAGMENTS)
	assert_gt(fx.clones_visible_count(), 0, "fading clones along the paths")
	p.player.respawning = false
	p.update_visuals(DT)
	p.update_visuals(SwarmRespawn.GATHER_MS * 0.5 / SkinCurves.MS_PER_S)
	assert_true(p.ball_visual().ball().visible)
	assert_almost_eq(p.ball_visual().ball().scale.x, 0.875, EPS, "ignites from half size, ease-out")
	assert_true(fx.is_rebirth_active(SwarmRespawn.GATHER_MS * 0.5))
	p.update_visuals(SwarmRespawn.GATHER_MS / SkinCurves.MS_PER_S)
	assert_eq(fx.fragments_visible_count(), 0, "gone after the gather")
