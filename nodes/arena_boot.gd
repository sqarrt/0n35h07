extends Node3D
## Wires the human controller, spawns a bot opponent, places both on the map's spawn points
## and runs the match once the arena is ready.

const PLAYER := preload("res://scenes/player.tscn")
const HUMAN_SLOT := 0
const BOT_SLOT := 1
const HUMAN_TEAM := 0   # 1v1: each slot is its own team (web teamOfSlot)
const BOT_TEAM := 1

func _ready() -> void:
	var raw_path: String = Game.selected_map
	var geo_path := raw_path.replace(".json", "_geo.json")
	add_child(GeoLoader.build(raw_path, geo_path))   # compiled geo.json geometry (what the game renders)
	var spawns := Spawns.positions_for([HUMAN_SLOT, BOT_SLOT], Spawns.from_raw(MapFiles.read_json(raw_path)))

	var human: PlayerNode = $Player
	human.player.id = HUMAN_SLOT
	human.place_at(spawns[HUMAN_SLOT])
	var camera: Camera3D = human.get_node("Camera3D")
	var hc: HumanController = $HumanController
	hc.setup(human, camera)
	# First-person: hide the player's own sphere (the camera sits inside it).
	human.set_body_visible(false)
	human.get_node("Mesh").visible = false

	var bot := _spawn_bot(human, spawns[BOT_SLOT])

	# Run the local match: human (team 0) vs bot (team 1).
	var match_node := MatchNode.new()
	add_child(match_node)
	match_node.add_entity(human, HUMAN_TEAM)
	match_node.add_entity(bot, BOT_TEAM)

	# HUD: crosshair + score + streak banner + respawn indicator.
	var hud := Hud.new()
	add_child(hud)
	hud.setup(human, match_node)

	# Pause menu (Esc): resume / back to the main menu.
	add_child(PauseOverlay.new())

func _spawn_bot(human: PlayerNode, spawn: Vector3) -> PlayerNode:
	var bot: PlayerNode = PLAYER.instantiate()
	bot.player.id = BOT_SLOT
	bot.player.body.position = spawn   # PlayerNode._ready copies it into the physics body
	bot.get_node("Camera3D").free()   # only the human's camera stays current
	add_child(bot)
	var get_target := func(): return human.player
	var los_rc := WorldRaycaster.new(get_world_3d().direct_space_state)
	var bot_ctrl := BotController.new(bot.player, get_target, los_rc, false, BotPersonality.from_name("Bot 1"))
	bot_ctrl.set_self_exclude([bot.hitbox_rid()])
	bot.controller = bot_ctrl
	return bot
