extends Node3D
## Wires the local player's controller, builds every seat of the room's roster on the map's spawn points and runs the
## match once the arena is ready. The roster comes from the lobby (or, for tools, the local profile and a bot named by
## the host). A room's START (Game.match_setup) makes it a mesh match: this peer simulates the players it owns — its
## player and its bots — and shows everyone else from their owners' snapshots (web Match owners / selfPeer).

const PLAYER := preload("res://scenes/player.tscn")
const HUMAN_SLOT := 0
const BOT_SLOT := 1
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
	var setup: Dictionary = Game.match_setup
	var local_id := int(setup.get("local_id", HUMAN_SLOT))
	var roster := _match_roster()
	var mode: String = Game.lobby_mode if not Game.lobby_roster.is_empty() else GameModes.DUEL
	var ids := roster.map(func(entry: Dictionary) -> int: return entry["id"])
	var map_spawns := Spawns.from_raw(MapFiles.read_json(raw_path))
	var ffa_spawns := _ffa_spawns(setup, ids.size(), map_spawns) if mode == GameModes.WAR else []
	var spawns := Spawns.positions_for_mode(mode, ids, map_spawns, ffa_spawns)

	var human: PlayerNode = $Player
	human.player.id = local_id
	human.place_at(spawns[local_id])
	var camera: Camera3D = human.get_node("Camera3D")
	var hc: HumanController = $HumanController
	# the profile's default view (web defaultThirdPerson); first person hides the player's own sphere
	hc.setup(human, camera, Game.profile.get("defaultView") == AppearanceConst.VIEW_THIRD_PERSON)

	# Run the match over every seat: teams by seat (web teamOfSlot), bots hunting the nearest enemy.
	var match_node := MatchNode.new()
	match_node.set_duration_ms(Game.match_duration_ms)
	match_node.local_id = local_id
	# web App match boot: the lobby role is the context; the match itself is a symmetric mesh
	GameLog.set_context({"role": ("creator" if Game.room == null or Game.room.is_host() else "joiner"), "localId": local_id,
		"code": String(setup.get("code", ""))})
	GameLog.log("room", "match_boot", {"mapId": raw_path.get_file().get_basename(), "durationMs": Game.match_duration_ms,
		"durationMin": Game.match_duration_ms / MatchConst.MS_PER_MIN, "mode": mode})
	if not setup.is_empty():
		match_node.configure_mesh(setup["owners"], setup["self_peer"])
	var nodes := {}
	for entry in roster:
		match_node.roster.add(entry)
		var id: int = entry["id"]
		nodes[id] = human if id == local_id else _spawn_other(entry, spawns[id], match_node)
	add_child(match_node)
	for entry in roster:
		var id: int = entry["id"]
		nodes[id].apply_appearance(match_node.roster.entry(id))
		var team := GameModes.team_of_slot(mode, id)
		match_node.add_entity(nodes[id], team, entry["kind"] == Roster.KIND_BOT)   # web: bots are ready from the start
		# web: plates only where friend / foe reading matters (not 1v1), never over the own model
		if mode != GameModes.DUEL and id != local_id:
			var plate_color: Color = GameModes.TEAM_COLORS[team] if mode == GameModes.BATTLE else Nameplate.NEUTRAL_COLOR
			nodes[id].set_nameplate(Nameplate.create(match_node.roster.name_of(id), plate_color))
	if match_node.mesh != null and Game.room != null:
		match_node.net_session = NetSession.new(Game.room.net, match_node)   # web session on the room's transport
	match_node.fired.connect(hc.on_fired)   # web: the local player's own shot shakes the camera
	match_node.singularity_changed.connect(func(active: bool) -> void: MapBlocks.set_transparent(get_tree(), active))
	SteamPresence.apply(SteamBridge, SteamPresence.SCREEN_GAME)   # web App: Rich Presence follows the screen

	# Steam achievements for the local player (web Game): none against a passive bot, a punching bag.
	var passive_bot := roster.any(func(entry: Dictionary) -> bool:
		return entry["kind"] == Roster.KIND_BOT and entry.get("difficulty", BOT_DIFFICULTY) == RoomModel.PASSIVE_DIFFICULTY)
	if not passive_bot:
		var achievements := MatchAchievements.new()
		achievements.setup(match_node, SteamAchievements.new(SteamBridge.unlock_achievement))
		add_child(achievements)

	# HUD: crosshair + score + streak banner + respawn indicator.
	var hud := Hud.new()
	add_child(hud)
	hud.setup(human, match_node)

	# Match sound: SFX transitions, combat and announce sounds, countdown / GO and the seeded match music.
	var match_audio := MatchAudio.new()
	match_audio.seed_code = String(setup.get("seed", ""))   # web: every peer plays the room's music
	add_child(match_audio)
	match_audio.setup(match_node, nodes.values(), local_id, self)

	# Pause menu (web App): a live match without the pointer lock; the match keeps running under it.
	var pause := PauseOverlay.new()
	pause.setup(match_node.is_live)
	pause.profile = Game.profile
	pause.profile_changed.connect(func(profile: Dictionary) -> void:   # web persist: saveProfile + live apply
		ProfileStore.save_profile(profile, Game.random.randf)
		Audio.apply_volumes()
		edges.set_enabled(bool(profile.get("postProcessing", true))))
	add_child(pause)

	# The ready ritual (web ReadyOverlay): a click takes the pointer (web handleReady) and confirms the local player.
	var ready_overlay := ReadyOverlay.new()
	add_child(ready_overlay)
	ready_overlay.setup(match_node)
	ready_overlay.ready_requested.connect(func() -> void:
		PointerLock.new().lock()
		if match_node.mark_ready(local_id):
			UiSounds.play("ready"))                  # web: the sound only on the transition to ready

	# Match-end screen (web MatchEndedOverlay), after the end freeze-frame; the match is no longer live, so no pause.
	var ended := MatchEndedOverlay.new()
	add_child(ended)
	match_node.match_ended.connect(func(result: Dictionary) -> void:
		ended.show_result(result, match_node.roster, match_node.streak_tiers()))

## Back to the menu (pause, match end): the room and its transport close with the match (web leaveRoom).
func _exit_tree() -> void:
	Game.leave_room()

## The lobby's seats in seat order; without a lobby (tools, tests) the profile's human and a bot named by the host
## (generated when empty) at the default level.
func _match_roster() -> Array:
	if not Game.lobby_roster.is_empty():
		var seats := Game.lobby_roster.duplicate()
		seats.sort_custom(func(a: Dictionary, b: Dictionary) -> bool: return a["id"] < b["id"])
		return seats
	var bot_name := ModelNames.bot_name(Game.lobby_bot_name, Game.random.randf)
	return [Roster.human_entry(HUMAN_SLOT, Game.profile), Roster.bot_entry(BOT_SLOT, bot_name, BOT_DIFFICULTY)]

## FFA start positions: the room creator's (web Start.spawns — the same on every peer), rolled here without a room.
func _ffa_spawns(setup: Dictionary, count: int, map_spawns: Array) -> Array:
	var shipped: Array = setup.get("spawns", [])
	if not shipped.is_empty():
		return shipped.map(func(p: Array) -> Vector3: return Vector3(p[0], p[1], p[2]))
	return Spawns.gen_ffa_spawns(count, (map_spawns[0] as Vector3).y, Game.random.randf)

## Another seat: a bot this peer owns is simulated here; anyone else is shown from their owner's snapshots.
func _spawn_other(entry: Dictionary, spawn: Vector3, match_node: MatchNode) -> PlayerNode:
	if entry["kind"] == Roster.KIND_BOT and match_node.owns(entry["id"]):
		return _spawn_bot(entry, spawn, match_node)
	var remote: PlayerNode = PLAYER.instantiate()
	remote.player.id = entry["id"]
	remote.replay = true                             # web: remotes have no controller and no local simulation
	remote.player.body.position = spawn
	remote.get_node("Camera3D").free()
	add_child(remote)
	return remote

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
