extends GutTest
## Match end parity with web Match.endMatch: when the clock runs out the phase ends, every player freezes,
## and the outcome is announced once, after the END_FREEZE_MS freeze-frame. Headless physics.

const PLAYER := preload("res://scenes/player.tscn")
const SHORT_MATCH_MS := 100.0
const PHYSICS_FPS := 60
const SAFETY_FRAMES := 30
const MS_PER_S := 1000.0

var _ended_calls := 0
var _result := {}

func _entity(arena: Node3D, id: int, pos: Vector3) -> PlayerNode:
	var p: PlayerNode = PLAYER.instantiate()
	p.player.id = id
	p.player.body.position = pos
	p.get_node("Camera3D").free()
	arena.add_child(p)
	return p

func _on_ended(result: Dictionary) -> void:
	_ended_calls += 1
	_result = result

func test_clock_end_freezes_players_and_announces_once_after_the_freeze_frame() -> void:
	var arena := Node3D.new()
	add_child_autofree(arena)
	var a := _entity(arena, 0, Vector3(0, MoveConst.EYE_HEIGHT, 0))
	var b := _entity(arena, 1, Vector3(0, MoveConst.EYE_HEIGHT, -6))
	var m := MatchNode.new()
	m.set_duration_ms(SHORT_MATCH_MS)
	arena.add_child(m)
	m.add_entity(a, 0)
	m.add_entity(b, 1)
	m.match_ended.connect(_on_ended)
	m.force_live()
	var frames := 0
	while not m.is_ended() and frames < PHYSICS_FPS:
		await get_tree().physics_frame
		frames += 1
	assert_true(m.is_ended(), "the clock ended the match")
	assert_true(a.player.frozen and b.player.frozen, "everyone freezes at the end")
	assert_eq(_ended_calls, 0, "the outcome waits for the freeze-frame")
	var freeze_frames := int(ceil(MatchConst.END_FREEZE_MS / MS_PER_S * PHYSICS_FPS)) + SAFETY_FRAMES
	for i in freeze_frames:
		await get_tree().physics_frame
	assert_eq(_ended_calls, 1, "announced exactly once")
	assert_eq(_result.get("reason"), MatchResult.REASON_TIME)
