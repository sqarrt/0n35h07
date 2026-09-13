class_name SfxEngine extends Node
## Plays match and UI sound effects — Godot counterpart of web ThreeSfxEngine, implementing the engine MatchSfx drives:
## play_at (positional, the web inverse-distance model), play_2d, has, start_loop / stop_loop. Every sound goes through
## the SFX bus: the web master gain x the user's effects level, then a capture for the AudioBar. The camera is the
## listener, as the web AudioListener rides on the camera.

const SFX_PATH := "res://assets/audio/sfx/%s.ogg"
const MANIFEST := "res://assets/audio/music/manifest.json"
const MASTER_OUT := "Master"
const MASTER_GAIN := 2.25                 # web SFX_MASTER_GAIN: the supplied sounds are quiet
const REF_DISTANCE := 6.0                 # web SFX_REF_DISTANCE: full level inside, 6 / distance beyond (rolloff 1)
const NO_DISTANCE_LIMIT := 0.0            # web clamps the distance at 60 m instead of cutting the sound off
const MAX_DB := 0.0                       # the inverse model never exceeds the source level up close
const DEFAULT_GAIN := 1.0                 # web SFX_GAIN[event] ?? 1
const DEFAULT_LOOP_GAIN := 0.5            # web startLoop fallback
const MIN_LINEAR := 0.0001
const EFFECT_AMPLIFY := 0
const EFFECT_CAPTURE := 1
const SFX_GAIN := {                       # web SFX_GAIN: sounds are not normalised, UI sits below gameplay
	"beam_fire": 0.9, "beam_fire_rage": 0.9, "beam_fire_singularity": 0.9, "block": 0.9, "shield_up": 0.8,
	"shield_down": 0.8, "cooldown_ready": 0.5, "dash": 0.8, "jump": 0.7, "land": 0.6, "death": 1.0, "respawn": 0.9,
	"ui_click": 0.4, "ui_hover": 0.3, "ui_toggle": 0.4, "ready": 0.5, "room_join": 0.5, "count_tick": 0.6, "go": 0.7,
	"catalyst": 0.85, "double_kill": 0.85, "triple_kill": 0.85, "singularity": 0.9, "shield_loop": 0.5, "ghost_loop": 0.5,
}

var bus_name := "Sfx"
var world_parent: Node3D                  # where positional one-shots live (the match root)

var _streams := {}                        # event -> AudioStream
var _loops := {}                          # key -> AudioStreamPlayer / AudioStreamPlayer3D
var _user_gain := 1.0

func _ready() -> void:
	var manifest: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(MANIFEST))
	for event in manifest["sfx"]:
		_streams[event] = load(SFX_PATH % event)
	var bus := AudioBuses.ensure(bus_name, MASTER_OUT)
	if AudioServer.get_bus_effect_count(bus) == 0:
		AudioServer.add_bus_effect(bus, AudioEffectAmplify.new(), EFFECT_AMPLIFY)
		AudioServer.add_bus_effect(bus, AudioEffectCapture.new(), EFFECT_CAPTURE)
	set_user_gain(_user_gain)

func _exit_tree() -> void:
	for key in _loops.keys():
		stop_loop(key)
	AudioBuses.remove(bus_name)

func has(event: String) -> bool:
	return _streams.has(event)

func capture() -> AudioEffectCapture:
	return AudioBuses.effect(bus_name, EFFECT_CAPTURE) as AudioEffectCapture

## The user's effects level 0..1 on top of the web master gain.
func set_user_gain(gain: float) -> void:
	_user_gain = clampf(gain, 0.0, 1.0)
	if is_inside_tree():
		(AudioBuses.effect(bus_name, EFFECT_AMPLIFY) as AudioEffectAmplify).volume_db = \
			linear_to_db(maxf(MIN_LINEAR, MASTER_GAIN * _user_gain))

func play_2d(event: String, gain := 1.0) -> void:
	if not has(event):
		return
	var player := AudioStreamPlayer.new()
	_one_shot(player, event, gain)
	add_child(player)
	player.play()

func play_at(event: String, pos: Vector3, gain := 1.0) -> void:
	if not has(event) or world_parent == null:
		return
	var player := _positional()
	_one_shot(player, event, gain)
	world_parent.add_child(player)
	player.global_position = pos
	player.play()

## A looping sound under `key`: 2D for a null target (your own player), else riding on the target.
func start_loop(event: String, key: String, target: Node3D) -> void:
	if _loops.has(key) or not has(event):
		return
	var player: Node = AudioStreamPlayer.new() if target == null else _positional()
	player.stream = _streams[event]
	player.bus = bus_name
	player.volume_db = linear_to_db(SFX_GAIN.get(event, DEFAULT_LOOP_GAIN))
	if target == null:
		add_child(player)
	else:
		target.add_child(player)
	player.play()
	_loops[key] = player

func stop_loop(key: String) -> void:
	var player = _loops.get(key)
	if player == null:
		return
	_loops.erase(key)
	if is_instance_valid(player):
		player.stop()
		player.queue_free()

func loop_count() -> int:
	return _loops.size()

func _one_shot(player: Node, event: String, gain: float) -> void:
	player.stream = _streams[event]
	player.bus = bus_name
	player.volume_db = linear_to_db(maxf(MIN_LINEAR, SFX_GAIN.get(event, DEFAULT_GAIN) * gain))
	player.finished.connect(player.queue_free)

func _positional() -> AudioStreamPlayer3D:
	var player := AudioStreamPlayer3D.new()
	player.attenuation_model = AudioStreamPlayer3D.ATTENUATION_INVERSE_DISTANCE
	player.unit_size = REF_DISTANCE
	player.max_db = MAX_DB
	player.max_distance = NO_DISTANCE_LIMIT
	return player
