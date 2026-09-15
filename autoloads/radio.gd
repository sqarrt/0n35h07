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

var model := RadioModel.new()
var host: RadioHost = null
var rights: RadioRights
var owns_dlc := func() -> bool: return SteamBridge.radio_dlc_owned()
var save_profile := func(profile: Dictionary) -> void: ProfileStore.save_profile(profile, Game.random.randf)
var today := func() -> String: return RadioEntitlement.today_key(Time.get_date_dict_from_system())

var _warmed := false
var _was_ready := false
var _screen := SCREEN_MENU
var _can_generate := true                       # the page's gate starts open

func _ready() -> void:
	model.changed.connect(_on_model_changed)
	rights = RadioRights.new(Game.profile, OS.has_feature(EDITOR_FEATURE))
	rights.changed.connect(_apply_gate)
	SteamBridge.overlay_closed.connect(recheck_dlc)
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

func is_available() -> bool:
	return host != null

## The profile's play / pause switch (web profile.radioEnabled).
func enabled() -> bool:
	return bool(Game.profile.get(KEY_ENABLED, false))

## web radioActive: switched on and the engine ready.
func is_active() -> bool:
	return enabled() and model.is_ready()

## web App warmup: once, lazily, from a menu screen — the mini-player lives on every one. DLC ownership resolves
## alongside, and the page learns whether it may generate before it starts.
func warm_up() -> void:
	if host == null or _warmed:
		return
	_warmed = true
	rights.resolve(Game.profile, owns_dlc.call())
	_apply_gate()
	host.init(Audio.radio_gain())

## The screen the radio plays under (web App screen): a menu screen, the trailer or a match.
func set_screen(screen: String) -> void:
	_screen = screen
	sync()

## Apply the switch, the volume and the screen to the engine (web App start/stop effect).
func sync() -> void:
	if host != null:
		RadioDirector.sync(host, model.is_ready(), enabled(), Audio.radio_gain(), _screen)
	changed.emit()

func next() -> void:
	if host != null:
		host.next()

func prev() -> void:
	if host != null:
		host.prev()

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
