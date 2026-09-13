extends GutTest
## HUD effect wiring parity with web Match.ts dispatches: the local player's shot -> BEAM_FLASH, the local player
## killed -> PLAYER_HIT, the local player blocked -> SHIELD_BLOCK; ghost / shield / windup vignettes follow the
## local player while the match is live.

const PLAYER := preload("res://scenes/player.tscn")
const SCREEN := Vector2i(1280, 720)
const HUMAN_ID := 0
const OTHER_ID := 1
const WINDUP_STEP_S := 0.2
const EPS := 0.001

var _match: MatchNode
var _human: PlayerNode
var _hud: Hud

func before_each() -> void:
	var screen := SubViewport.new()
	screen.size = SCREEN
	add_child_autofree(screen)
	_human = PLAYER.instantiate()
	_human.get_node("Camera3D").free()
	screen.add_child(_human)
	_match = MatchNode.new()
	screen.add_child(_match)
	_hud = Hud.new()
	screen.add_child(_hud)
	_hud.setup(_human, _match)
	_match.force_live()

func _layer(node_name: String) -> CanvasItem:
	return _hud.find_child(node_name, true, false) as CanvasItem

func test_match_node_reports_shots_blocks_and_kills() -> void:
	watch_signals(_match)
	_match.emit_events([
		{"t": "fired", "id": HUMAN_ID},
		{"t": "block", "shooter": OTHER_ID, "victim": HUMAN_ID, "perfect": true},
		{"t": "kill", "shooter": OTHER_ID, "victim": HUMAN_ID, "streak": 1, "first_blood": true},
	])
	assert_signal_emitted_with_parameters(_match, "fired", [HUMAN_ID])
	assert_signal_emitted_with_parameters(_match, "blocked", [OTHER_ID, HUMAN_ID, true])
	assert_signal_emitted_with_parameters(_match, "frag", [OTHER_ID, HUMAN_ID, 1, true])

func test_only_the_local_players_shot_flashes() -> void:
	_match.fired.emit(OTHER_ID)
	assert_false(_layer("BeamTint").visible, "the opponent's shots don't flash your screen")
	_match.fired.emit(HUMAN_ID)
	assert_true(_layer("BeamTint").visible, "web BEAM_FLASH on your own shot")

func test_being_killed_and_blocking_flash() -> void:
	_match.frag.emit(OTHER_ID, HUMAN_ID, 1, false)
	assert_true(_layer("HitTint").visible, "web PLAYER_HIT when the local player dies")
	_match.blocked.emit(OTHER_ID, HUMAN_ID, false)
	assert_true(_layer("BlockTint").visible, "web SHIELD_BLOCK when the local player blocks")

func test_vignettes_follow_the_local_player() -> void:
	_human.player.activate_shield()
	_human.player.start_firing()
	_human.player.update_weapon(WINDUP_STEP_S, [])
	_human.player.respawning = true
	_hud._process(0.0)
	assert_gt(_human.player.windup_progress(), 0.0, "the fixture really is charging")
	assert_true(_layer("GhostVignette").visible, "ghost phase")
	assert_true(_layer("ShieldVignette").visible, "shield up")
	assert_almost_eq(_layer("WindupVignette").modulate.a, _human.player.windup_progress(), EPS, "charge")
