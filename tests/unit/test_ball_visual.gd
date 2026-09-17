extends GutTest
## Ball skin nodes parity with web Body / ballMaterial and Player.syncVisuals: models, ring, facing, ghost opacity,
## windup swell, the death burst and the rebirth poof, and the shield hidden in first person.

const PLAYER := preload("res://scenes/player.tscn")
const EPS := 0.001
const DT := 1.0 / 60.0
const ENTRY := {"id": 1, "name": "EX82R", "color": "#fd4", "reserveColor": "#f55", "ballModel": "planet",
	"windupStyle": "classic", "respawnStyle": "echo", "dashStyle": "streak", "shieldStyle": "hex"}

func _player() -> PlayerNode:
	var p: PlayerNode = PLAYER.instantiate()
	p.get_node("Camera3D").free()
	add_child_autofree(p)
	p.apply_appearance(ENTRY)
	return p

func test_models_ring_and_facing() -> void:
	var ball := BallVisual.new()
	add_child_autofree(ball)
	ball.setup(Color("#4af"), "waves", Color("#4af"))
	assert_true(ball.material().get_shader_parameter("waves"))
	assert_null(ball.ring(), "only the planet has a ring")
	ball.setup(Color("#4af"), "planet", Color("#f55"))
	assert_not_null(ball.ring())
	assert_almost_eq(ball.ring().rotation_degrees.x, 70.0, EPS, "BALL_RING_TILT_DEG")
	ball.face_dir(Vector3(1.0, -5.0, 0.0))
	assert_almost_eq(ball.ball().rotation.y, -PI / 2.0, EPS, "yaw only, -Z toward the look")
	ball.set_opacity(1.0)
	ball.set_opacity(0.4)
	assert_almost_eq(ball.ball().transparency, 0.6, EPS)

func test_facing_ignores_the_yaw_of_the_node_it_rides() -> void:
	var carrier := Node3D.new()      # PlayerNode turns with the camera; the web mesh sat in the unturned world
	add_child_autofree(carrier)
	carrier.rotation.y = 1.0
	var ball := BallVisual.new()
	carrier.add_child(ball)
	ball.setup(Color("#4af"), "planet", Color("#f55"))
	ball.face_dir(Vector3(0.0, 0.0, -1.0))
	assert_almost_eq(ball.ball().global_rotation.y, 0.0, EPS, "the model faces the look, not the carrier's turn twice")
	ball.face_dir(Vector3(1.0, 0.0, 0.0))
	assert_almost_eq(ball.ball().global_rotation.y, -PI / 2.0, EPS)

func test_player_takes_the_roster_look() -> void:
	var p := _player()
	assert_eq(p.ball_visual().material().get_shader_parameter("albedo"), Color("#fd4"))
	assert_not_null(p.ball_visual().ring(), "EX82R rolls the planet model")
	assert_almost_eq(p.ball_visual().position.y, SkinCurves.BODY_MESH_Y, EPS)

func test_ghost_is_translucent_and_bursts_on_death() -> void:
	var p := _player()
	p.update_visuals(DT)
	p.player.respawning = true
	p.update_visuals(DT)
	assert_true(p.ball_visual().visible, "the echo ghost stays visible")
	assert_almost_eq(p.ball_visual().ball().transparency, 1.0 - SkinCurves.GHOST_OPACITY, EPS)
	assert_eq(p.burst_view().visible_count(), SkinCurves.DEATH_BURST_COUNT, "death burst on the death edge")
	p.update_visuals(DT)
	assert_gt(p.ghost_trail_view().visible_count(), 0, "the ghost leaves clones")

func test_rebirth_poof_after_the_ghost() -> void:
	var p := _player()
	p.player.respawning = true
	p.update_visuals(DT)
	p.player.respawning = false
	p.update_visuals(DT)   # the materialisation edge starts the poof clock
	p.update_visuals(SkinCurves.SPAWN_ANIM_MS * 0.5 / SkinCurves.MS_PER_S)
	assert_gt(p.ball_visual().ball().scale.x, 1.0, "springy poof")
	assert_almost_eq(p.ball_visual().ball().transparency, 0.0, EPS)

func test_first_person_hides_ball_and_burst() -> void:
	var p := _player()
	p.set_body_visible(false)
	p.player.respawning = true
	p.update_visuals(DT)
	assert_false(p.ball_visual().visible)
	assert_eq(p.burst_view().visible_count(), 0, "web: no burst for your own hidden body")
