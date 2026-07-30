extends GutTest
## A bot PlayerNode chases a stationary target and can be shot — real physics, headless.

const PLAYER := preload("res://scenes/player.tscn")

func _floor(arena: Node3D) -> void:
	var sb := StaticBody3D.new()
	sb.collision_layer = CombatConst.LAYER_WORLD_BIT
	var cs := CollisionShape3D.new()
	var b := BoxShape3D.new(); b.size = Vector3(80, 1, 80)
	cs.shape = b; cs.position = Vector3(0, -0.5, 0)
	sb.add_child(cs); arena.add_child(sb)

func _entity(arena: Node3D, id: int, pos: Vector3) -> PlayerNode:
	var p: PlayerNode = PLAYER.instantiate()
	p.player.id = id
	p.player.body.position = pos
	p.get_node("Camera3D").free()
	arena.add_child(p)
	return p

func test_bot_chases_the_target() -> void:
	var arena := Node3D.new()
	add_child_autofree(arena)
	_floor(arena)
	var target := _entity(arena, 0, Vector3(0, MoveConst.EYE_HEIGHT, -15))
	var bot := _entity(arena, 1, Vector3(0, MoveConst.EYE_HEIGHT, 0))
	await get_tree().physics_frame
	var los_rc := WorldRaycaster.new(get_tree().root.world_3d.direct_space_state)
	var ctrl := BotController.new(bot.player, func(): return target.player, los_rc,
		false, BotPersonality.from_name("Chaser"))
	ctrl.set_self_exclude([bot.hitbox_rid()])
	bot.controller = ctrl
	var z0 := bot.global_position.z
	for i in range(120):
		await get_tree().physics_frame
	assert_lt(bot.global_position.z, z0 - 1.0, "bot chased the target toward -Z")
