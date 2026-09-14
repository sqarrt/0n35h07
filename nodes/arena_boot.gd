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
	Audio.stop_menu_music()   # web App: the menu music fades out in the match
	var raw_path: String = Game.selected_map
	var geo_path := raw_path.replace(".json", "_geo.json")
	add_child(GeoLoader.build(raw_path, geo_path))   # compiled geo.json geometry (what the game renders)
	var edges := MapEdges.new()                      # web Arena: {postFx && <MapEdges />}
	edges.enabled = bool(Game.profile.get("postProcessing", true))
	add_child(edges)
	add_child(MapLights.build())                     # web MapLights + the page background as the sky
	# The lobby's seats and preset (web RoomSession start); tools without a lobby get the classic human vs bot.
	var roster := _match_roster()
	var mode: String = Game.lobby_mode if not Game.lobby_roster.is_empty() else GameModes.DUEL
	var ids := roster.map(func(entry: Dictionary) -> int: return entry["id"])
	var map_spawns := Spawns.from_raw(MapFiles.read_json(raw_path))
	var ffa_spawns := Spawns.gen_ffa_spawns(ids.size(), (map_spawns[0] as Vector3).y, Game.random.randf) \
		if mode == GameModes.WAR else []
	var spawns := Spawns.positions_for_mode(mode, ids, map_spawns, ffa_spawns)

	var human: PlayerNode = $Player
	human.player.id = HUMAN_SLOT
	human.place_at(spawns[HUMAN_SLOT])
	var camera: Camera3D = human.get_node("Camera3D")
	var hc: HumanController = $HumanController
	hc.setup(human, camera)   # first person hides the player's own sphere (the camera sits inside it)

	# Run the local match over every seat: teams by seat (web teamOfSlot), bots hunting the nearest enemy.
	var match_node := MatchNode.new()
	match_node.set_duration_ms(Game.match_duration_ms)
	match_node.local_id = HUMAN_SLOT
	var nodes := {}
	for entry in roster:
		match_node.roster.add(entry)
		var id: int = entry["id"]
		nodes[id] = human if id == HUMAN_SLOT else _spawn_bot(entry, spawns[id], match_node)
	add_child(match_node)
	for id in nodes:
		nodes[id].apply_appearance(match_node.roster.entry(id))
		var team := GameModes.team_of_slot(mode, id)
		match_node.add_entity(nodes[id], team)
		# web: plates only where friend / foe reading matters (not 1v1), never over the own model
		if mode != GameModes.DUEL and id != HUMAN_SLOT:
			var plate_color: Color = GameModes.TEAM_COLORS[team] if mode == GameModes.BATTLE else Nameplate.NEUTRAL_COLOR
			nodes[id].set_nameplate(Nameplate.create(match_node.roster.name_of(id), plate_color))
	match_node.fired.connect(hc.on_fired)   # web: the local player's own shot shakes the camera
	match_node.singularity_changed.connect(func(active: bool) -> void: MapBlocks.set_transparent(get_tree(), active))

	# HUD: crosshair + score + streak banner + respawn indicator.
	var hud := Hud.new()
	add_child(hud)
	hud.setup(human, match_node)

	# Match sound: SFX transitions, combat and announce sounds, countdown / GO and the seeded match music.
	var match_audio := MatchAudio.new()
	add_child(match_audio)
	match_audio.setup(match_node, nodes.values(), HUMAN_SLOT, self)

	# Pause menu (web App): a live match without the pointer lock; the match keeps running under it.
	var pause := PauseOverlay.new()
	pause.setup(match_node.is_live)
	add_child(pause)

	# Match-end screen (web MatchEndedOverlay), after the end freeze-frame; the match is no longer live, so no pause.
	var ended := MatchEndedOverlay.new()
	add_child(ended)
	match_node.match_ended.connect(func(result: Dictionary) -> void:
		ended.show_result(result, match_node.roster, match_node.streak_tiers()))

## The lobby's seats in seat order; without a lobby (tools, tests) the profile's human and a bot named by the host
## (generated when empty) at the default level.
func _match_roster() -> Array:
	if not Game.lobby_roster.is_empty():
		var seats := Game.lobby_roster.duplicate()
		seats.sort_custom(func(a: Dictionary, b: Dictionary) -> bool: return a["id"] < b["id"])
		return seats
	var bot_name := ModelNames.bot_name(Game.lobby_bot_name, Game.random.randf)
	return [Roster.human_entry(HUMAN_SLOT, Game.profile), Roster.bot_entry(BOT_SLOT, bot_name, BOT_DIFFICULTY)]

func _spawn_bot(entry: Dictionary, spawn: Vector3, match_node: MatchNode) -> PlayerNode:
	var bot: PlayerNode = PLAYER.instantiate()
	bot.player.id = entry["id"]
	bot.player.body.position = spawn   # PlayerNode._ready copies it into the physics body
	bot.get_node("Camera3D").free()   # only the human's camera stays current
	add_child(bot)
	var get_target := func(): return NearestEnemy.of(bot.player, match_node.players())
	var los_rc := WorldRaycaster.new(get_world_3d().direct_space_state)
	var passive: bool = entry.get("difficulty", BOT_DIFFICULTY) == RoomModel.PASSIVE_DIFFICULTY
	var bot_ctrl := BotController.new(bot.player, get_target, los_rc, passive, BotPersonality.from_name(entry["name"]))
	bot_ctrl.set_self_exclude([bot.hitbox_rid()])
	bot.controller = bot_ctrl
	return bot
