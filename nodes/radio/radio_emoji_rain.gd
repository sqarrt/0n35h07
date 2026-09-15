class_name RadioEmojiRain extends Node3D
## The Radio takeover's emoji rain — port of web RadioTakeover EmojiRain: a pool of 36 emoji (the bundled Twemoji Mozilla
## colour font, 48 px in a 64 px sprite 0.12 world units wide) on a plane 3.2 units ahead of the camera, facing it. Only a
## beat births them: a batch of 1–2 by its strength appears just above the top edge of the view, spread across 90% of its
## width; every beat also dashes their fall (×(1 + 6·strength), decaying over 0.09 s) and pops their size (×(1 + 1.1·
## strength), 0.08 s). They fall at 0.35 + 0.4·level units a second, each at its own speed and size, and vanish just past
## the bottom. The set follows the track's mood (RadioEmojiMoods); the pool outlives a change of track.

const FONT := preload("res://assets/fonts/Twemoji.Mozilla.ttf")
const MAX := 36                                 # web RADIO_EMOJI_MAX
const BURST_MIN := 1
const BURST_MAX := 2
const FALL_MIN := 0.35                          # web RADIO_EMOJI_FALL_MIN (units per second)
const FALL_LEVEL := 0.4
const DASH_STRENGTH := 6.0
const DASH_TAU := 0.09
const PULSE_STRENGTH := 1.1
const PULSE_TAU := 0.08
const SPRITE_PX := 64.0                         # web RADIO_EMOJI_SPRITE_PX
const FONT_PX := 48                             # web RADIO_EMOJI_FONT_PX
const SCALE := 0.12                             # web RADIO_EMOJI_SCALE: the sprite's world size
const DEPTH := 3.2                              # web RADIO_EMOJI_DEPTH
const RENDER_ORDER := 20                        # web RADIO_EMOJI_RENDER_ORDER (+ index: a stable order)
const SPEED_VAR := 0.9
const SIZE_VAR := 0.8
const SPAWN_TOP := 1.06
const SPAWN_TOP_JIT := 0.12
const SPREAD_FRAC := 0.9
const KILL_FRAC := 1.08
const MAX_DT := 0.1
const HALF := 0.5

class Drop:
	var label: Label3D
	var active := false
	var speed := 1.0
	var size := 1.0

var random := func() -> float: return randf()

var _drops: Array[Drop] = []
var _set: Array = RadioEmojiMoods.FALLBACK
var _dash := 1.0
var _pulse := 1.0

func _init() -> void:
	name = "EmojiRain"
	for i in MAX:
		var label := Label3D.new()
		label.name = "Emoji%d" % i
		label.font = FONT
		label.font_size = FONT_PX
		label.outline_size = 0
		label.pixel_size = SCALE / SPRITE_PX
		label.no_depth_test = true
		label.shaded = false
		label.double_sided = true
		label.render_priority = RENDER_ORDER + i
		label.visible = false
		add_child(label)
		var drop := Drop.new()
		drop.label = label
		_drops.append(drop)

func set_mood(mood: String) -> void:
	_set = RadioEmojiMoods.set_for(mood)

func drops() -> Array[Drop]:
	return _drops

func active_count() -> int:
	return _drops.filter(func(drop: Drop) -> bool: return drop.active).size()

## One frame after the camera moved: follow it, burst on a beat, fall, pop and clear the ones past the bottom.
func step(dt: float, camera: Camera3D, aspect: float, beat_fired: bool, beat_strength: float, level: float) -> void:
	var clamped := minf(dt, MAX_DT)
	global_transform = Transform3D(camera.global_basis, camera.global_position - camera.global_basis.z * DEPTH)
	var half_height := DEPTH * tan(deg_to_rad(camera.fov) * HALF)
	var half_width := half_height * aspect
	if beat_fired:
		_dash = 1.0 + DASH_STRENGTH * beat_strength
		_pulse = 1.0 + PULSE_STRENGTH * beat_strength
		var batch := BURST_MIN + roundi((BURST_MAX - BURST_MIN) * beat_strength)
		for k in batch:
			var free := _free_drop()
			if free == null:
				break
			_spawn(free, half_width, half_height)
	_dash += (1.0 - _dash) * (1.0 - exp(-clamped / DASH_TAU))
	_pulse += (1.0 - _pulse) * (1.0 - exp(-clamped / PULSE_TAU))
	var fall := (FALL_MIN + FALL_LEVEL * level) * _dash
	var kill_y := -half_height * KILL_FRAC
	for drop in _drops:
		if not drop.active:
			continue
		drop.label.scale = Vector3.ONE * _pulse * drop.size
		drop.label.position.y -= fall * drop.speed * clamped
		if drop.label.position.y <= kill_y:
			drop.active = false
			drop.label.visible = false

func _free_drop() -> Drop:
	for drop in _drops:
		if not drop.active:
			return drop
	return null

func _spawn(drop: Drop, half_width: float, half_height: float) -> void:
	drop.label.text = _set[floori(float(random.call()) * _set.size()) % _set.size()]
	drop.active = true
	drop.speed = 1.0 + (float(random.call()) - HALF) * SPEED_VAR
	drop.size = 1.0 + (float(random.call()) - HALF) * SIZE_VAR
	drop.label.visible = true
	drop.label.position = Vector3((float(random.call()) - HALF) * 2.0 * half_width * SPREAD_FRAC,
		half_height * (SPAWN_TOP + (float(random.call()) - HALF) * 2.0 * SPAWN_TOP_JIT), 0.0)
