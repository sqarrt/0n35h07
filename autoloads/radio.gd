extends Node
## The Radio (autoload, after Audio) — web App radio mode on the desktop build: the engine page hosted off screen
## (WebViewRadioTransport → RadioHost), warmed up once from a menu screen, playing while the profile's radioEnabled says so
## (RadioDirector), with RadioModel as the player shows it. Where there is no WebView (a -s tool, headless, no extension)
## the model stays idle and the player shows "—" dimmed, like the web build before its engine is ready.
## The free daily trial (RadioRights): the page stops generating when today's quota is spent, each new track counts and
## saves the profile, and owning the DLC — asked of Steam at warm-up, again when the overlay closes or the window comes
## back to focus — lifts the limit and resumes a stream that halted.

signal changed

const KEY_ENABLED := "radioEnabled"
const SCREEN_MENU := "menu"
const EDITOR_FEATURE := "editor"                # web import.meta.env.DEV: a run from the editor is unlimited
const LEVEL_SCALE := 12.0                       # web RADIO_LEVEL_SCALE: the normalised meter at the menu music's size
const MODE_GEN := "gen"                         # web RadioPlayMode: the live generative stream ...
const MODE_FAV := "fav"                         # ... or a library folder's queue of baked tracks
const SAVE_PROMPT_S := 4.0                      # web radioSavePrompt: the "saves used up" line
const PAYLOAD_VERSION := 2                      # web TrackPayload v
const STATE_CODE := "strudelCode"
const STATE_SEED := "seed"
const STATE_TRACK_INDEX := "trackIndex"

var model := RadioModel.new()
var host: RadioHost = null
var rights: RadioRights
var owns_dlc := func() -> bool: return SteamBridge.radio_dlc_owned()
var save_profile := func(profile: Dictionary) -> void: ProfileStore.save_profile(profile, Game.random.randf)
var today := func() -> String: return RadioEntitlement.today_key(Time.get_date_dict_from_system())

var play_mode := MODE_GEN
var queue := RadioQueue.new()
var save_limited := false                       # a save was just refused: the player shows the prompt

var _warmed := false
var _save_prompt_token := 0
var _was_ready := false
var _screen := SCREEN_MENU
var _radio_for_match := false
var _can_generate := true                       # the page's gate starts open
var _meter_reader := Callable()
var _bands_reader := Callable()

func _ready() -> void:
	model.changed.connect(_on_model_changed)
	rights = RadioRights.new(Game.profile, OS.has_feature(EDITOR_FEATURE))
	rights.changed.connect(_apply_gate)
	SteamBridge.overlay_closed.connect(recheck_dlc)
	Audio.volumes_applied.connect(apply_volume)   # web App: master × radio follows every volume slider at once
	if DisplayStartup.is_tool_run(OS.get_cmdline_args()) or not WebViewRadioTransport.available():
		return
	var transport := WebViewRadioTransport.new()
	transport.attach(self)
	attach_host(RadioHost.new(transport))

## The engine page this radio drives (a fake transport's in tests).
func attach_host(radio_host: RadioHost) -> void:
	host = radio_host
	model.bind(host)
	host.generated.connect(_on_generated)
	host.track_ended.connect(_on_track_ended)
	var meter := model                          # web: the radio's level joins the menu's audio analysis
	_meter_reader = func() -> float: return meter.meter_level * LEVEL_SCALE
	Audio.analysis.add_level_reader(_meter_reader)
	_bands_reader = func(out: PackedFloat32Array) -> void:   # the page sends its bands at one count (web readBands)
		if out.size() != meter.meter_bands.size():
			return
		for i in out.size():
			out[i] = maxf(out[i], meter.meter_bands[i])
	Audio.analysis.add_band_reader(_bands_reader)

func is_available() -> bool:
	return host != null

## The profile's play / pause switch (web profile.radioEnabled).
func enabled() -> bool:
	return bool(Game.profile.get(KEY_ENABLED, false))

## web radioActive: switched on and the engine ready.
func is_active() -> bool:
	return enabled() and model.is_ready()

## web engine.readLevel for the LIBRARY visualizer: the page's output level, unscaled.
func level() -> float:
	return model.meter_level

## web engine.readBands into 24: the page's visualizer bands this frame.
func vis_bands() -> PackedFloat32Array:
	return model.meter_vis_bands

## web App warmup: once, lazily, from a menu screen — the mini-player lives on every one. DLC ownership resolves
## alongside, and the page learns whether it may generate before it starts.
func warm_up() -> void:
	if host == null or _warmed:
		return
	_warmed = true
	rights.resolve(Game.profile, owns_dlc.call())
	_apply_gate()
	host.init(Audio.radio_gain())

## The screen the radio plays under (web App screen): a menu screen, the trailer or a match; `for_match` says the radio
## was playing when that match started (web gameNet.radioForMatch), so it stays the soundtrack.
func set_screen(screen: String, for_match := false) -> void:
	_screen = screen
	_radio_for_match = for_match
	sync()

## Apply the switch, the volume and the screen to the engine (web App start/stop effect).
func sync() -> void:
	if host != null:
		RadioDirector.sync(host, model.is_ready(), enabled(), Audio.radio_gain(), _screen, _radio_for_match)
	changed.emit()

## web radioNext / radioPrev: the library queue steps round, the live stream skips a track.
func next() -> void:
	_step(1)

func prev() -> void:
	_step(-1)

## web onPlayLibrary: a folder's readable tracks become the queue and the library plays from `start`.
func play_library(tracks: Array, start: int) -> void:
	if host == null or tracks.is_empty():
		return
	queue.set_tracks(tracks, start)
	play_mode = MODE_FAV
	host.play_baked(queue.current())
	changed.emit()

## web onRadioMode: On Air leaves the baked queue for the live generator (a no-op while already on air).
func set_play_mode(mode: String) -> void:
	if mode == play_mode:
		return
	play_mode = mode
	if mode == MODE_GEN and host != null:
		host.resume_generative()
	changed.emit()

## web currentTrackJSON: the audible track as a v2 library payload, or {} when no program is playing.
func current_track_payload() -> Dictionary:
	var state := model.musical_state
	var program := str(state.get(STATE_CODE, ""))
	if host == null or program.is_empty():
		return {}
	var label := model.track_label()
	var seed := str(state.get(STATE_SEED, ""))
	return {
		"v": PAYLOAD_VERSION,
		"id": RadioLibrary.track_id(seed, int(state.get(STATE_TRACK_INDEX, 0))) if not seed.is_empty() else label,
		"name": label,
		"bpm": state.get("bpm", 0.0),
		"bars": model.bars,
		"info": {"mood": state.get("mood", ""), "key": state.get("key", ""), "scale": state.get("scaleName", "")},
		"program": program,
	}

## web onSaveTrack: a save the trial allows goes into `folder` and counts (the profile saved); a spent quota refuses
## it and shows the prompt for 4 s.
func save_track(library: RadioLibrary, folder: String, payload: Dictionary) -> bool:
	if not rights.entitlement(Game.profile, today.call())["can_save"]:
		_show_save_prompt()
		return false
	library.save_track(folder, payload)
	rights.note_saved(Game.profile, today.call())
	save_profile.call(Game.profile)
	changed.emit()
	return true

func _step(offset: int) -> void:
	if host == null:
		return
	if play_mode == MODE_FAV and not queue.is_empty():
		host.play_baked(queue.step(offset))
	elif offset > 0:
		host.next()
	else:
		host.prev()

## web onTrackEndRef: a finished queue track moves on to the next (looping); the live stream carries on by itself.
func _on_track_ended() -> void:
	if play_mode == MODE_FAV and not queue.is_empty():
		host.play_baked(queue.step(1))

func _show_save_prompt() -> void:
	save_limited = true
	_save_prompt_token += 1
	var token := _save_prompt_token
	changed.emit()
	if is_inside_tree():
		get_tree().create_timer(SAVE_PROMPT_S).timeout.connect(func() -> void:
			if token == _save_prompt_token:
				save_limited = false
				changed.emit())

## web radioSeek: the track jumps to a fraction and the bar shows it at once.
func seek(fraction: float) -> void:
	if host == null:
		return
	host.seek(fraction)
	model.set_progress(fraction)

## web: the master × radio level follows the profile, playing or paused.
func apply_volume() -> void:
	if host != null:
		host.set_volume(Audio.radio_gain())

## The expanded player's free-trial strip ({gens_left, saves_left}; empty when unlimited or not known yet).
func trial_strip() -> Dictionary:
	return rights.trial_strip(Game.profile, today.call())

func can_unlock() -> bool:
	return rights.can_unlock()

## web genLimited (the Radio screen adds itself): on the trial, switched on, no generation left today.
func gen_limited() -> bool:
	var allowed := rights.entitlement(Game.profile, today.call())
	return not allowed["unlimited"] and enabled() and allowed["gens_left"] == 0.0

## web live-unlock: ask Steam again — the store may just have sold the DLC — and let a new day's trial reopen the gate.
func recheck_dlc() -> void:
	rights.recheck(Game.profile, owns_dlc.call())
	_apply_gate()

## The Radio DLC's store page (web openRadioStore).
func open_store() -> void:
	SteamBridge.open_radio_store()

func _notification(what: int) -> void:
	if what == NOTIFICATION_APPLICATION_FOCUS_IN and rights != null:
		recheck_dlc()
	elif what == NOTIFICATION_PREDELETE and _meter_reader.is_valid():
		Audio.analysis.remove_level_reader(_meter_reader)
		Audio.analysis.remove_band_reader(_bands_reader)

func _on_generated() -> void:
	rights.note_generated(Game.profile, today.call())
	save_profile.call(Game.profile)

## web canGenerate + the "resume a stream halted at the gen limit" effect: tell the page when generation opens or
## closes; reopening resumes the stream if the radio is switched on.
func _apply_gate() -> void:
	if host == null:
		return
	var can_generate: bool = rights.entitlement(Game.profile, today.call())["can_generate"]
	if can_generate != _can_generate:
		_can_generate = can_generate
		host.set_gate(can_generate)
		if can_generate:
			sync()
			return
	changed.emit()

func _on_model_changed() -> void:
	if model.is_ready() and not _was_ready:   # the engine just came up: play if switched on
		_was_ready = true
		sync()
		return
	changed.emit()
