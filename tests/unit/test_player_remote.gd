extends GutTest
## A player driven from outside (a peer's snapshot or a demo frame) — web Player.applyNetState: its visuals and HUD
## read what it was told (shot charge, dash, shield, readiness, ghost time) instead of a local simulation.

const EPS := 0.0001

func _snapshot(extra := {}) -> Dictionary:
	var snap := {"id": 1, "pos": [1.0, 2.0, 3.0], "aim": [0.0, 0.0, 1.0], "alive": true, "respawning": false,
		"shield": true, "dashing": true, "windup": 0.6}
	snap.merge(extra, true)
	return snap

func test_a_remote_player_shows_what_it_was_told() -> void:
	var p := Player.new()
	NetProtocol.apply_player_snapshot(p, _snapshot({"beam": 0.3, "dash_ready": 0.5, "shield_ready": 0.2}))
	assert_eq(p.position(), Vector3(1.0, 2.0, 3.0))
	assert_eq(p.look_dir(), Vector3(0.0, 0.0, 1.0))
	assert_almost_eq(p.windup_progress(), 0.6, EPS)
	assert_true(p.is_winding_up())
	assert_true(p.is_shielded())
	assert_true(p.is_dashing())
	assert_almost_eq(p.beam_progress(), 0.3, EPS)
	assert_almost_eq(p.dash_progress(), 0.5, EPS)
	assert_almost_eq(p.shield_progress(), 0.2, EPS)

func test_readiness_defaults_to_ready_without_hud_fields() -> void:
	var p := Player.new()
	NetProtocol.apply_player_snapshot(p, _snapshot())
	assert_eq(p.beam_progress(), 1.0, "a peer's snapshot carries no HUD readiness")
	assert_eq(p.dash_progress(), 1.0)
	assert_eq(p.shield_progress(), 1.0)

func test_the_ghost_timer_follows_the_snapshot() -> void:
	var p := Player.new()
	NetProtocol.apply_player_snapshot(p, _snapshot({"alive": false, "respawning": true, "respawn_left": 0.5}))
	assert_true(p.respawning)
	assert_almost_eq(p.respawn_timer, 0.5 * MatchConst.RESPAWN_GHOST_MS, EPS, "web respawnProgress 1 -> 0")

func test_local_players_keep_their_simulation() -> void:
	var p := Player.new()
	assert_null(p.remote)
	assert_false(p.is_dashing())
	assert_eq(p.windup_progress(), 0.0)
	assert_false(p.is_shielded())
