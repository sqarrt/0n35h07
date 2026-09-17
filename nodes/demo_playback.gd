class_name DemoPlayback extends Node3D
## One trailer play shot — port of web components/trailer/DemoScene: the recorded map (geometry, lights, block
## outlines), every roster player as a replayed PlayerNode (its look from the roster, the local ring in the reserve
## colour), the recording's camera between frames, the match HUD through a replay MatchNode, and each frame's events —
## shots, deaths with the streak banner, blocks and respawns. Sounds leave as `sound` (web onSfx) for the sequencer to
## play at its gain: the shot sound starts with the windup, dash and shield sound on their edges.

signal sound(event: String)
signal ready_to_show                           # web onReady: warmed up, lift the cover
signal near_end                                # web onNearEnd: just before the last fragment ends
signal ended
signal announced(player_name: String, kind: String, color: Color)   # web onAnnounce: the sequencer's streak banner

const PLAYER := preload("res://scenes/player.tscn")
const CLEAR_COLOR := Color("#05070d")          # web ShotView: the trailer canvas clears to #05070d, not the page bg
const WARMUP_FRAMES := 3                       # web WARMUP_FRAMES
const WINDUP_EDGE := 0.02                      # web: a windup crossing this starts the shot sound
const BEAM_SOUNDS := {"classic": "beam_fire", "rage": "beam_fire_rage", "singularity": "beam_fire_singularity"}
const DASH_SOUND := "dash"
const SHIELD_UP_SOUND := "shield_up"
const SHIELD_DOWN_SOUND := "shield_down"
const DEATH_SOUND := "death"
const BLOCK_SOUND := "block"
const RESPAWN_SOUND := "respawn"
const WINDUP := 0                              # the remembered flags per player
const DASHING := 1
const SHIELD := 2

## The replay HUD always shows (web renders it in every play shot, no pointer lock involved).
class ReplayLock extends PointerLock:
	func is_locked() -> bool:
		return true

var _clip: DemoClip
var _ranges: Array
var _reserve_color := ""
var _timeline: DemoTimeline
var _nodes := {}                               # id -> PlayerNode
var _styles := {}                              # id -> windup style
var _flags := {}                               # id -> [windup, dashing, shield]
var _camera: Camera3D
var _match: MatchNode
var _hud: Hud
var _warm := 0
var _held := false

## The clip, its fragments ([[from, to], ...]) and the profile's ring colour for the local player, used when the
## recording carries none.
func setup(clip: DemoClip, ranges: Array, reserve_color := "") -> void:
	_clip = clip
	_ranges = ranges
	_reserve_color = clip.reserve_color if clip.reserve_color != "" else reserve_color   # web demo.reserveColor ?? profile

func _ready() -> void:
	physics_interpolation_mode = Node.PHYSICS_INTERPOLATION_MODE_OFF   # the replay poses everyone per rendered frame
	add_child(GeoLoader.build(MapCatalog.raw_path(_clip.map_id), MapCatalog.geo_path(_clip.map_id)))
	add_child(MapEdges.new())                      # web DemoScene: the in-game block outlines
	var lights := MapLights.build()
	add_child(lights)
	(lights.get_node("Environment") as WorldEnvironment).environment.background_color = CLEAR_COLOR
	(lights.get_node("Sun") as DirectionalLight3D).shadow_enabled = false   # web ShotView's Canvas has no `shadows`
	_camera = Camera3D.new()
	_camera.name = "ReplayCamera"
	add_child(_camera)
	_camera.current = true
	_match = MatchNode.new()
	_match.replay = true
	_match.local_id = _clip.local_id
	for entry in _clip.roster:
		_match.roster.add(entry)
	add_child(_match)
	for entry in _clip.roster:
		_add_player(entry)
	_match.phase.force_live()
	_hud = Hud.new()
	_hud.replay = true                             # web TrailerSequencer: no audio bar, stats or overheat
	add_child(_hud)
	_hud.setup(_nodes[_clip.local_id], _match, ReplayLock.new())
	_timeline = DemoTimeline.new(_clip, _ranges)
	var first: Dictionary = _clip.frames[_timeline.first_frame()]
	_place(first, first, 0.0)
	_seed_flags(first)

## Parity frames (web __debugTrailerHoldFrame): the clock stays on the fragment's first frame.
func hold() -> void:
	_held = true

func camera() -> Camera3D:
	return _camera

func match_node() -> MatchNode:
	return _match

func player_node(id: int) -> PlayerNode:
	return _nodes.get(id)

func _process(delta: float) -> void:
	if _timeline == null or _timeline.ended:
		return
	if _warm < WARMUP_FRAMES:
		_warm += 1
		if _warm == WARMUP_FRAMES:
			ready_to_show.emit()
	var step := _timeline.step(0.0 if _held else delta)
	_place(_clip.frames[step["frame"]], _clip.frames[step["next"]], step["blend"])
	for index in step["events"]:
		_apply_events(_clip.frames[index])
	if step["near_end"]:
		near_end.emit()
	if step["cut"]:
		_seed_flags(_clip.frames[_timeline.first_frame()])   # web seedFlags: no false sounds at the seam
	if step["ended"]:
		ended.emit()

func _add_player(entry: Dictionary) -> void:
	var id := int(entry["id"])
	var node := PLAYER.instantiate() as PlayerNode
	node.replay = true
	node.player.id = id
	add_child(node)
	node.get_node("Camera3D").free()               # the recording's camera is the only one
	var look := entry.duplicate()
	if id == _clip.local_id and _reserve_color != "":
		look["reserveColor"] = _reserve_color      # web: the local planet ring takes the reserve colour
	node.apply_appearance(look)
	_match.add_entity(node, id)                    # demos are 1v1: every seat its own team (web hudOf)
	_nodes[id] = node
	_styles[id] = entry.get("windupStyle", AppearanceConst.WINDUP_STYLES[0])

## Players, camera and clock between two frames (web: flags and aim from the frame, the position and camera blended).
func _place(frame: Dictionary, next: Dictionary, blend: float) -> void:
	for state in frame["players"]:
		var id := int(state["id"])
		var node: PlayerNode = _nodes.get(id)
		if node == null:
			continue
		NetProtocol.apply_player_snapshot(node.player, DemoClip.snapshot(state))
		node.set_body_visible(bool(state["bodyVisible"]))
		var later := DemoClip.state_of(next, id, state)
		node.place_at(DemoClip.position(state).lerp(DemoClip.position(later), blend))
		node.player.kills = int(state["kills"])
		node.player.deaths = int(state["deaths"])
		node.player.streak = int(state["streakCount"])
		_sound_edges(id, state)
	var cam := DemoClip.camera(frame)
	var cam_next := DemoClip.camera(next)
	_camera.global_position = (cam["position"] as Vector3).lerp(cam_next["position"], blend)
	_camera.quaternion = (cam["rotation"] as Quaternion).slerp(cam_next["rotation"], blend)
	_camera.fov = lerpf(cam["fov"], cam_next["fov"], blend)
	_match.replay_seconds_left = DemoClip.seconds_left(frame)

func _sound_edges(id: int, state: Dictionary) -> void:
	var was: Array = _flags.get(id, [0.0, false, false])
	var windup := float(state["windupProgress"])
	var dashing := bool(state["dashing"])
	var shield := bool(state["shieldActive"])
	if float(was[WINDUP]) <= WINDUP_EDGE and windup > WINDUP_EDGE:
		sound.emit(BEAM_SOUNDS.get(_styles[id], BEAM_SOUNDS[AppearanceConst.WINDUP_STYLES[0]]))
	if not was[DASHING] and dashing:
		sound.emit(DASH_SOUND)
	if not was[SHIELD] and shield:
		sound.emit(SHIELD_UP_SOUND)
	if was[SHIELD] and not shield:
		sound.emit(SHIELD_DOWN_SOUND)
	_flags[id] = [windup, dashing, shield]

func _seed_flags(frame: Dictionary) -> void:
	_flags.clear()
	for state in frame["players"]:
		_flags[int(state["id"])] = [float(state["windupProgress"]), bool(state["dashing"]), bool(state["shieldActive"])]

## web applyFrameEvents: the frame's transient effects (moves, scores and time come from the absolute fields).
func _apply_events(frame: Dictionary) -> void:
	for event in frame["events"]:
		match String(event["t"]):
			"fired":
				var shooter: PlayerNode = _nodes.get(int(event["id"]))
				if shooter != null:
					var hit = event.get("hitPoint")
					shooter.play_remote_beam(DemoClip.vector(event["end"]), DemoClip.vector(hit) if hit != null else null)
			"kill":
				var victim := int(event["victim"])
				if _nodes.has(victim):
					(_nodes[victim] as PlayerNode).player.apply_death()
				sound.emit(DEATH_SOUND)
				var streak := int(event.get("streak", 0))
				var first_blood := bool(event.get("firstBlood", false))
				var kind := Streak.announce_kind(streak, first_blood)
				if kind != "":
					sound.emit(MatchAudioCues.announce_event(kind))
					var shooter_id := int(event["shooter"])   # web: the roster name, its colour or #4af
					announced.emit(_match.roster.name_of(shooter_id), kind, _match.roster.color_of(shooter_id,
						UiTokens.ACCENT.to_html(false)))
				_match.frag.emit(int(event["shooter"]), victim, streak, first_blood)   # the HUD's banner and flashes
			"block":
				sound.emit(BLOCK_SOUND)
			"respawn":
				var id := int(event["id"])
				if _nodes.has(id):
					var pos := DemoClip.vector(event["pos"])
					(_nodes[id] as PlayerNode).player.respawn_at(pos)
					(_nodes[id] as PlayerNode).place_at(pos)
				sound.emit(RESPAWN_SOUND)
