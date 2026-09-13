class_name MusicEngine extends Node
## Plays loop arrangements on bar-quantised role slots — Godot counterpart of web WebAudioMusicEngine. Each slot is an
## AudioStreamPlayer with an AudioStreamInteractive holding silence and every stem of its role (loudness normalisation
## is baked into the stems); a switch requested within a loop lands on the next 8-second bar with a 120 ms crossfade.
## All slots start together under AudioServer.lock(). Slot buses carry the pan, the doubled copy's delay, the reverb and
## echo sends and feed the engine bus: fade x user level x the web master gain, the match-end tail echo, and a capture
## for the AudioBar. `provider` returns the voices of a loop index (MusicDirector / MenuMusicArranger).

const MANIFEST := "res://assets/audio/music/manifest.json"
const STEM_PATH := "res://assets/audio/music/%s.ogg"
const CROSSFADE_SEC := 0.12                     # web CROSSFADE_SEC
const SECONDS_PER_MINUTE := 60.0
const START_FADE_SEC := 0.5                     # web START_FADE_SEC
const END_FADE_SEC := 0.8                       # web END_FADE_SEC
const MASTER_GAIN_DEFAULT := 0.6                # web MASTER_GAIN_DEFAULT
const GAIN_SMOOTHING_SEC := 0.05                # web setTargetAtTime time constant for the volume slider
const ECHO_DELAY_MS := 350.0                    # web ECHO_DELAY_SEC
const ECHO_TAIL_FEEDBACK := 0.5                 # web ECHO_FEEDBACK (match end)
const ECHO_PLAY_FEEDBACK := 0.28                # web ECHO_PLAY_FEEDBACK
const ECHO_WET := 0.45                          # web ECHO_WET
const REVERB_WET := 0.5                         # web REVERB_WET
const REVERB_ROOM := 0.6                        # approximates the web 1.8 s decaying-noise convolution
const REVERB_DAMPING := 0.5
const MS_PER_S := 1000.0
const USEC_PER_SEC := 1000000.0
const SILENT_DB := -80.0
const MIN_LINEAR := 0.0001
const SLOT_ROLES := {
	MusicSlots.SLOT_KICKS: MusicDirector.ROLE_KICKS, MusicSlots.SLOT_BASS: MusicDirector.ROLE_BASS,
	MusicSlots.SLOT_SFX: MusicDirector.ROLE_SFX, MusicSlots.SLOT_LEAD_A: MusicDirector.ROLE_LEAD,
	MusicSlots.SLOT_LEAD_B: MusicDirector.ROLE_LEAD, MusicSlots.SLOT_DOUBLE: MusicDirector.ROLE_LEAD,
}
const EFFECT_PANNER := 0
const EFFECT_COPY_DELAY := 1
const EFFECT_REVERB := 2
const EFFECT_ECHO := 3
const EFFECT_AMPLIFY := 0
const EFFECT_TAIL := 1
const EFFECT_CAPTURE := 2

var bus_prefix := "Music"                        # separate engines (match / menu) get separate buses

var _provider: Callable
var _fade_in_sec := START_FADE_SEC
var _manifest := {}
var _slots := MusicSlots.new()
var _scheduler := MusicScheduler.new()
var _players := {}                                # slot -> AudioStreamPlayer
var _pending := {}                                # slot -> state waiting for its boundary
var _states := {}                                 # slot -> state now playing
var _started := false
var _start_usec := 0
var _fade := 0.0
var _fade_from := 0.0
var _fade_to := 1.0
var _fade_sec := 0.0
var _fade_elapsed := 0.0
var _user_gain := 1.0
var _smoothed_gain := 1.0
var _scheduling := true

func setup(provider: Callable, fade_in_sec := START_FADE_SEC) -> void:
	_provider = provider
	_fade_in_sec = fade_in_sec

func master_bus() -> String:
	return bus_prefix

func slot_bus(slot: String) -> String:
	return "%s_%s" % [bus_prefix, slot]

func capture() -> AudioEffectCapture:
	return AudioServer.get_bus_effect(AudioServer.get_bus_index(master_bus()), EFFECT_CAPTURE) as AudioEffectCapture

func loop_index() -> int:
	return _scheduler.applied_loop()

## Stem ids sounding in the current loop (web activeStemIds, for debugging and tests).
func active_stem_ids() -> Array:
	return _states.values().map(func(s: Dictionary) -> String: return s["stem_id"]) \
		.filter(func(id: String) -> bool: return id != MusicSlots.SILENT)

func is_started() -> bool:
	return _started

## Build the buses and slots, set up loop 0 and start every slot in the same mix, fading in.
func start() -> void:
	if _started:
		return
	_manifest = JSON.parse_string(FileAccess.get_file_as_string(MANIFEST))
	_build_buses()
	var first := _slots.assign(_provider.call(0))
	for slot in MusicSlots.ALL_SLOTS:
		_players[slot] = _build_player(slot, first[slot]["stem_id"])
		_apply_state(slot, first[slot])
	_states = first
	AudioServer.lock()
	for player in _players.values():
		player.play()
	AudioServer.unlock()
	_start_usec = Time.get_ticks_usec()
	_started = true
	_fade_to_level(1.0, _fade_in_sec)

## Fade out and stop requesting loops; the tail echo rings the fading music out (web fadeOut).
func fade_out(sec := END_FADE_SEC, tail_echo := true) -> void:
	if not _started:
		return
	_scheduling = false
	_fade_to_level(0.0, sec)
	AudioServer.set_bus_effect_enabled(AudioServer.get_bus_index(master_bus()), EFFECT_TAIL, tail_echo)

## The user's music level 0..1 on top of the web master gain (smoothed like setTargetAtTime).
func set_user_gain(gain: float) -> void:
	_user_gain = clampf(gain, 0.0, 1.0)
	if not _started:
		_smoothed_gain = _user_gain

func _process(delta: float) -> void:
	if _started:
		step((Time.get_ticks_usec() - _start_usec) / USEC_PER_SEC, delta)

## One engine frame at `elapsed_s` since playback started (exposed for deterministic tests).
func step(elapsed_s: float, delta: float) -> void:
	if _scheduling:
		for action in _scheduler.actions(elapsed_s):
			match action["t"]:
				MusicScheduler.REQUEST, MusicScheduler.SKIP:
					_request(int(action["loop"]))
				MusicScheduler.APPLY:
					_apply_pending()
	_fade_elapsed += delta
	_fade = _fade_to if _fade_sec <= 0.0 else lerpf(_fade_from, _fade_to, minf(_fade_elapsed / _fade_sec, 1.0))
	_smoothed_gain += (_user_gain - _smoothed_gain) * (1.0 - exp(-delta / GAIN_SMOOTHING_SEC))
	var amplify := AudioServer.get_bus_effect(AudioServer.get_bus_index(master_bus()), EFFECT_AMPLIFY) as AudioEffectAmplify
	amplify.volume_db = linear_to_db(maxf(MIN_LINEAR, _fade * _smoothed_gain * MASTER_GAIN_DEFAULT))

## Ramp the fade linearly from its current level (web linearRampToValueAtTime on the master gain).
func _fade_to_level(level: float, sec: float) -> void:
	_fade_from = _fade
	_fade_to = level
	_fade_sec = sec
	_fade_elapsed = 0.0

func _exit_tree() -> void:
	for slot in MusicSlots.ALL_SLOTS:
		_remove_bus(slot_bus(slot))
	_remove_bus(master_bus())

func _request(loop: int) -> void:
	var states := _slots.assign(_provider.call(loop))
	for slot in MusicSlots.ALL_SLOTS:
		var stem: String = states[slot]["stem_id"]
		if stem != _states.get(slot, MusicSlots.silent_state())["stem_id"]:
			var playback := (_players[slot] as AudioStreamPlayer).get_stream_playback() as AudioStreamPlaybackInteractive
			if playback != null:
				playback.switch_to_clip_by_name(_clip_name(stem))
	_pending = states

func _apply_pending() -> void:
	for slot in _pending:
		_apply_state(slot, _pending[slot])
	_states = _pending
	_pending = {}

func _apply_state(slot: String, state: Dictionary) -> void:
	(_players[slot] as AudioStreamPlayer).volume_db = linear_to_db(maxf(MIN_LINEAR, state["gain"]))
	var bus := AudioServer.get_bus_index(slot_bus(slot))
	(AudioServer.get_bus_effect(bus, EFFECT_PANNER) as AudioEffectPanner).pan = state["pan"]
	var copy := AudioServer.get_bus_effect(bus, EFFECT_COPY_DELAY) as AudioEffectDelay
	copy.tap1_delay_ms = state["delay_sec"] * MS_PER_S
	AudioServer.set_bus_effect_enabled(bus, EFFECT_COPY_DELAY, state["delay_sec"] > 0.0)
	var reverb := AudioServer.get_bus_effect(bus, EFFECT_REVERB) as AudioEffectReverb
	reverb.wet = state["reverb"] * REVERB_WET
	AudioServer.set_bus_effect_enabled(bus, EFFECT_REVERB, state["reverb"] > 0.0)
	var echo := AudioServer.get_bus_effect(bus, EFFECT_ECHO) as AudioEffectDelay
	echo.tap1_level_db = linear_to_db(maxf(MIN_LINEAR, state["echo"] * ECHO_WET))
	AudioServer.set_bus_effect_enabled(bus, EFFECT_ECHO, state["echo"] > 0.0)

func _build_player(slot: String, initial_stem: String) -> AudioStreamPlayer:
	var ids: Array = [_manifest["silence"]]
	ids.append_array(_manifest["roles"][SLOT_ROLES[slot]])
	var interactive := AudioStreamInteractive.new()
	interactive.clip_count = ids.size()
	for i in ids.size():
		interactive.set_clip_stream(i, load(STEM_PATH % ids[i]))
		interactive.set_clip_name(i, StringName(ids[i]))
	interactive.initial_clip = maxi(0, ids.find(initial_stem if initial_stem != MusicSlots.SILENT else ids[0]))
	var fade_beats := CROSSFADE_SEC * float(_manifest["bpm"]) / SECONDS_PER_MINUTE
	interactive.add_transition(AudioStreamInteractive.CLIP_ANY, AudioStreamInteractive.CLIP_ANY,
		AudioStreamInteractive.TRANSITION_FROM_TIME_NEXT_BAR, AudioStreamInteractive.TRANSITION_TO_TIME_START,
		AudioStreamInteractive.FADE_CROSS, fade_beats)
	var player := AudioStreamPlayer.new()
	player.name = "Slot_%s" % slot
	player.stream = interactive
	player.bus = slot_bus(slot)
	add_child(player)
	return player

func _clip_name(stem: String) -> StringName:
	return StringName(_manifest["silence"] if stem == MusicSlots.SILENT else stem)

func _build_buses() -> void:
	var master := _add_bus(master_bus(), "Master")
	AudioServer.add_bus_effect(master, AudioEffectAmplify.new(), EFFECT_AMPLIFY)
	var tail := AudioEffectDelay.new()
	tail.dry = 1.0
	tail.tap1_active = true
	tail.tap1_delay_ms = ECHO_DELAY_MS
	tail.tap1_level_db = linear_to_db(ECHO_WET)
	tail.tap2_active = false
	tail.feedback_active = true
	tail.feedback_delay_ms = ECHO_DELAY_MS
	tail.feedback_level_db = linear_to_db(ECHO_TAIL_FEEDBACK)
	AudioServer.add_bus_effect(master, tail, EFFECT_TAIL)
	AudioServer.set_bus_effect_enabled(master, EFFECT_TAIL, false)
	AudioServer.add_bus_effect(master, AudioEffectCapture.new(), EFFECT_CAPTURE)
	for slot in MusicSlots.ALL_SLOTS:
		var bus := _add_bus(slot_bus(slot), master_bus())
		AudioServer.add_bus_effect(bus, AudioEffectPanner.new(), EFFECT_PANNER)
		var copy := AudioEffectDelay.new()
		copy.dry = 0.0
		copy.tap1_active = true
		copy.tap1_level_db = 0.0
		copy.tap1_pan = 0.0
		copy.tap2_active = false
		copy.feedback_active = false
		AudioServer.add_bus_effect(bus, copy, EFFECT_COPY_DELAY)
		var reverb := AudioEffectReverb.new()
		reverb.dry = 1.0
		reverb.room_size = REVERB_ROOM
		reverb.damping = REVERB_DAMPING
		AudioServer.add_bus_effect(bus, reverb, EFFECT_REVERB)
		var echo := AudioEffectDelay.new()
		echo.dry = 1.0
		echo.tap1_active = true
		echo.tap1_delay_ms = ECHO_DELAY_MS
		echo.tap1_pan = 0.0
		echo.tap2_active = false
		echo.feedback_active = true
		echo.feedback_delay_ms = ECHO_DELAY_MS
		echo.feedback_level_db = linear_to_db(ECHO_PLAY_FEEDBACK)
		AudioServer.add_bus_effect(bus, echo, EFFECT_ECHO)
		for effect in [EFFECT_COPY_DELAY, EFFECT_REVERB, EFFECT_ECHO]:
			AudioServer.set_bus_effect_enabled(bus, effect, false)

func _add_bus(bus_name: String, send: String) -> int:
	var index := AudioServer.get_bus_index(bus_name)
	if index != -1:
		return index
	AudioServer.add_bus()
	index = AudioServer.get_bus_count() - 1
	AudioServer.set_bus_name(index, bus_name)
	AudioServer.set_bus_send(index, send)
	return index

func _remove_bus(bus_name: String) -> void:
	var index := AudioServer.get_bus_index(bus_name)
	if index != -1:
		AudioServer.remove_bus(index)
