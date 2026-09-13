class_name MenuMusicArranger extends RefCounted
## Menu background music arrangement — port of web game/audio/MenuMusic.ts: a constant kick, a bass that mostly
## plays and occasionally rests one loop, and two colour layers that independently breathe in for at most two loops
## followed by a rest, plus occasional doubling / reverb / echo on a separate seeded stream. Local only (no sync).

const KICK_ID := "kicks/sub_long"
const BASS_ID := "bass/kutting"
const COLOR_IDS := ["lead/crickets_tex", "lead/lwt_14"]
const KICK_GAIN := 1.0
const BASS_GAIN := 0.9
const COLOR_GAIN := 0.5
const COLOR_ON_PROB := 0.25
const COLOR_ON_LOOPS := 2
const COLOR_REST_LOOPS := 1
const BASS_OFF_PROB := 0.25
const BASS_OFF_LOOPS := 1
const BASS_PLAY_LOOPS := 1
const FADE_IN_SEC := 2.0
const FADE_OUT_SEC := 0.6
const FX_SEED := 0x4d65
const DOUBLE_PROB := 0.50
const DOUBLE_MIN_SEC := 0.035
const DOUBLE_MAX_SEC := 0.090
const REVERB_PROB := 0.40
const REVERB := 0.20
const ECHO_PROB := 0.40
const ECHO := 0.20

var _rng: Callable
var _fx := MusicRng.new(FX_SEED)
var _color_on := []
var _color_rest := []
var _bass_rest := 0
var _bass_play := 0

func _init(rng: Callable) -> void:
	_rng = rng
	reset()

## The ids the menu needs loaded.
static func stem_ids() -> Array:
	return [KICK_ID, BASS_ID] + COLOR_IDS

## Clear the layer windows (web stop(); the variety stream keeps running).
func reset() -> void:
	_color_on = COLOR_IDS.map(func(_id: String) -> int: return 0)
	_color_rest = COLOR_IDS.map(func(_id: String) -> int: return 0)
	_bass_rest = 0
	_bass_play = 0

func arrange(_loop_index: int) -> Array:
	var voices := [{"role": MusicDirector.ROLE_KICKS, "stem_id": KICK_ID, "gain": KICK_GAIN}]
	if _step_bass():
		voices.append({"role": MusicDirector.ROLE_BASS, "stem_id": BASS_ID, "gain": BASS_GAIN})
	for i in COLOR_IDS.size():
		if _step_color(i):
			voices.append({"role": MusicDirector.ROLE_LEAD, "stem_id": COLOR_IDS[i], "gain": COLOR_GAIN})
	_apply_variety(voices)
	return voices

func _apply_variety(voices: Array) -> void:
	var color := {}
	for voice in voices:
		if voice["role"] == MusicDirector.ROLE_LEAD:
			color = voice
			break
	if not color.is_empty() and _fx.next() < DOUBLE_PROB:
		color["double_sec"] = DOUBLE_MIN_SEC + _fx.next() * (DOUBLE_MAX_SEC - DOUBLE_MIN_SEC)
	if _fx.next() < REVERB_PROB:
		for voice in voices:
			if voice["role"] != MusicDirector.ROLE_KICKS:
				voice["reverb"] = REVERB
	if not color.is_empty() and _fx.next() < ECHO_PROB:
		color["echo"] = ECHO

func _step_color(i: int) -> bool:
	if _color_rest[i] > 0:
		_color_rest[i] -= 1
		return false
	if _color_on[i] > 0:
		_color_on[i] -= 1
		if _color_on[i] == 0:
			_color_rest[i] = COLOR_REST_LOOPS
		return true
	if _rng.call() < COLOR_ON_PROB:
		_color_on[i] = COLOR_ON_LOOPS - 1
		if _color_on[i] == 0:
			_color_rest[i] = COLOR_REST_LOOPS
		return true
	return false

func _step_bass() -> bool:
	if _bass_play > 0:
		_bass_play -= 1
		return true
	if _bass_rest > 0:
		_bass_rest -= 1
		if _bass_rest == 0:
			_bass_play = BASS_PLAY_LOOPS
		return false
	if _rng.call() < BASS_OFF_PROB:
		_bass_rest = BASS_OFF_LOOPS - 1
		if _bass_rest == 0:
			_bass_play = BASS_PLAY_LOOPS
		return false
	return true
