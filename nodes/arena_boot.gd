extends Node3D
## Wires the human controller, spawns a bot opponent, and runs the match once the arena is ready.

const PLAYER := preload("res://scenes/player.tscn")

func _ready() -> void:
	var human: PlayerNode = $Player
	human.player.id = 0
	var camera: Camera3D = human.get_node("Camera3D")
	var hc: HumanController = $HumanController
	hc.setup(human, camera)
	# First-person: hide the player's own sphere (the camera sits inside it).
	human.set_body_visible(false)
	human.get_node("Mesh").visible = false

	var bot := _spawn_bot(human)

	# Run the local match: human (team 0) vs bot (team 1).
	var match_node := MatchNode.new()
	add_child(match_node)
	match_node.add_entity(human, 0)
	match_node.add_entity(bot, 1)

func _spawn_bot(human: PlayerNode) -> PlayerNode:
	var bot: PlayerNode = PLAYER.instantiate()
	bot.player.id = 1
	bot.player.body.position = Vector3(8, MoveConst.EYE_HEIGHT, -10)
	bot.get_node("Camera3D").free()   # only the human's camera stays current
	add_child(bot)
	var get_target := func(): return human.player
	var los_rc := WorldRaycaster.new(get_world_3d().direct_space_state)
	var bot_ctrl := BotController.new(bot.player, get_target, los_rc, false, BotPersonality.from_name("Bot 1"))
	bot_ctrl.set_self_exclude([bot.hitbox_rid()])
	bot.controller = bot_ctrl
	return bot
