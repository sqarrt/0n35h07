extends Node
## The Radio (autoload, after Audio) — web App radio mode on the desktop build: the engine page hosted off screen
## (WebViewRadioTransport → RadioHost), warmed up once from a menu screen, playing while the profile's radioEnabled says so
## (RadioDirector), with RadioModel as the player shows it. Where there is no WebView (a -s tool, headless, no extension)
## the model stays idle and the player shows "—" dimmed, like the web build before its engine is ready.

signal changed

const KEY_ENABLED := "radioEnabled"
const SCREEN_MENU := "menu"

var model := RadioModel.new()
var host: RadioHost = null

var _warmed := false
var _was_ready := false
var _screen := SCREEN_MENU

func _ready() -> void:
	model.changed.connect(_on_model_changed)
	if DisplayStartup.is_tool_run(OS.get_cmdline_args()) or not WebViewRadioTransport.available():
		return
	var transport := WebViewRadioTransport.new()
	transport.attach(self)
	host = RadioHost.new(transport)
	model.bind(host)

func is_available() -> bool:
	return host != null

## The profile's play / pause switch (web profile.radioEnabled).
func enabled() -> bool:
	return bool(Game.profile.get(KEY_ENABLED, false))

## web radioActive: switched on and the engine ready.
func is_active() -> bool:
	return enabled() and model.is_ready()

## web App warmup: once, lazily, from a menu screen — the mini-player lives on every one.
func warm_up() -> void:
	if host == null or _warmed:
		return
	_warmed = true
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

func _on_model_changed() -> void:
	if model.is_ready() and not _was_ready:   # the engine just came up: play if switched on
		_was_ready = true
		sync()
		return
	changed.emit()
