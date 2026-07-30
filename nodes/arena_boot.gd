extends Node3D
## Wires the human controller and spawns a bot opponent once the arena is ready.

const PLAYER := preload("res://scenes/player.tscn")

func _ready() -> void:
	var pnode: PlayerNode = $Player
	pnode.player.id = 0
	var camera: Camera3D = pnode.get_node("Camera3D")
	var hc: HumanController = $HumanController
	hc.setup(pnode, camera)
	# First-person: hide the player's own sphere so the camera (at eye level, inside the
	# sphere) isn't occluded by it. TP will re-show it in a later slice.
	pnode.get_node("Mesh").visible = false

	_spawn_bot(pnode)

func _spawn_bot(human: PlayerNode) -> void:
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
