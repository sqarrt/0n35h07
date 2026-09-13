extends Node3D
## Wires the human controller, spawns a bot opponent, places both on the map's spawn points
## and runs the match once the arena is ready. The roster comes from the local profile and the bot's generated
## model name (web RoomSession: the bot name seeds both its look and its personality).

const PLAYER := preload("res://scenes/player.tscn")
const HUMAN_SLOT := 0
const BOT_SLOT := 1
const HUMAN_TEAM := 0   # 1v1: each slot is its own team (web teamOfSlot)
const BOT_TEAM := 1
const BOT_DIFFICULTY := "normal"   # web addBot default

func _ready() -> void:
	var raw_path: String = Game.selected_map
	var geo_path := raw_path.replace(".json", "_geo.json")
	add_child(GeoLoader.build(raw_path, geo_path))   # compiled geo.json geometry (what the game renders)
	add_child(MapLights.build())                     # web MapLights + the page background as the sky
	var spawns := Spawns.positions_for([HUMAN_SLOT, BOT_SLOT], Spawns.from_raw(MapFiles.read_json(raw_path)))

	var human: PlayerNode = $Player
	human.player.id = HUMAN_SLOT
	human.place_at(spawns[HUMAN_SLOT])
	var camera: Camera3D = human.get_node("Camera3D")
	var hc: HumanController = $HumanController
	hc.setup(human, camera)   # first person hides the player's own sphere (the camera sits inside it)

	var bot_name := ModelNames.bot_name(Game.lobby_bot_name, Game.random.randf)
	var bot := _spawn_bot(human, spawns[BOT_SLOT], bot_name)

	# Run the local match: human (team 0) vs bot (team 1).
	var match_node := MatchNode.new()
	match_node.set_duration_ms(Game.match_duration_ms)
	match_node.local_id = HUMAN_SLOT
	match_node.roster.add(Roster.human_entry(HUMAN_SLOT, Game.profile))
	match_node.roster.add(Roster.bot_entry(BOT_SLOT, bot_name, BOT_DIFFICULTY))
	add_child(match_node)
	human.apply_appearance(match_node.roster.entry(HUMAN_SLOT))
	bot.apply_appearance(match_node.roster.entry(BOT_SLOT))
	match_node.add_entity(human, HUMAN_TEAM)
	match_node.add_entity(bot, BOT_TEAM)
	match_node.fired.connect(hc.on_fired)   # web: the local player's own shot shakes the camera
	match_node.singularity_changed.connect(func(active: bool) -> void: MapBlocks.set_transparent(get_tree(), active))

	# HUD: crosshair + score + streak banner + respawn indicator.
	var hud := Hud.new()
	add_child(hud)
	hud.setup(human, match_node)

	# Pause menu (Esc): resume / back to the main menu.
	var pause := PauseOverlay.new()
	add_child(pause)

	# Match-end screen (web MatchEndedOverlay), after the end freeze-frame; no pause menu from then on.
	var ended := MatchEndedOverlay.new()
	add_child(ended)
	match_node.match_ended.connect(func(result: Dictionary) -> void:
		pause.enabled = false
		ended.show_result(result, match_node.roster, match_node.streak_tiers()))

func _spawn_bot(human: PlayerNode, spawn: Vector3, bot_name: String) -> PlayerNode:
	var bot: PlayerNode = PLAYER.instantiate()
	bot.player.id = BOT_SLOT
	bot.player.body.position = spawn   # PlayerNode._ready copies it into the physics body
	bot.get_node("Camera3D").free()   # only the human's camera stays current
	add_child(bot)
	var get_target := func(): return human.player
	var los_rc := WorldRaycaster.new(get_world_3d().direct_space_state)
	var bot_ctrl := BotController.new(bot.player, get_target, los_rc, false, BotPersonality.from_name(bot_name))
	bot_ctrl.set_self_exclude([bot.hitbox_rid()])
	bot.controller = bot_ctrl
	return bot
