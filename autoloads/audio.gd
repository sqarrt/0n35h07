extends Node
## Global audio (autoload, after Game) — web App's single SFX engine for menus and matches, the menu music and the sound
## analysis the HUD visualiser draws. Volumes follow the profile: master x effects for SFX, master x menu music for the
## menu, master x music for a match (the match owns its own MusicEngine).

const SFX_BUS := "Sfx"
const MENU_MUSIC_BUS := "MenuMusic%d"          # a fresh prefix per session: a fading session keeps its own buses
const TRAILER_MUSIC_BUS := "TrailerMusic%d"
const TRAILER_ECHO_TAIL_SEC := 2.6             # web ECHO_TAIL_MS: the echo rings out before the session goes
const KEY_MASTER := "volumeMaster"
const KEY_MUSIC := "volumeMusic"
const KEY_SFX := "volumeSfx"
const KEY_MENU_MUSIC := "volumeMenuMusic"

var analysis := AudioAnalysisHub.new()
var debug_bands := PackedFloat32Array()        # parity fixtures: a fixed spectrum instead of the live sound

var _sfx: SfxEngine
var _menu_rng := RandomNumberGenerator.new()   # web Math.random for the menu layers
var _menu_arranger: MenuMusicArranger
var _menu_music: MusicEngine
var _trailer_arranger := TrailerMusicArranger.new()
var _trailer_music: MusicEngine
var _music_sessions := 0

func _ready() -> void:
	_menu_rng.randomize()
	_menu_arranger = MenuMusicArranger.new(_menu_rng.randf)
	_sfx = SfxEngine.new()
	_sfx.name = "Sfx"
	_sfx.bus_name = SFX_BUS
	add_child(_sfx)
	analysis.add_capture(_sfx.capture())
	apply_volumes()

func _process(_delta: float) -> void:
	analysis.update()

func sfx() -> SfxEngine:
	return _sfx

func menu_music() -> MusicEngine:
	return _menu_music

## The spectrum the HUD visualiser draws: the fixture's bands when set (web __debugAudioBands), else the live analysis.
func bands() -> PackedFloat32Array:
	return analysis.bands() if debug_bands.is_empty() else debug_bands

func play_ui(event: String) -> void:
	_sfx.play_2d(event)

## Re-read the profile volumes (web App effects on the volume sliders).
func apply_volumes() -> void:
	_sfx.set_user_gain(_volume(KEY_MASTER) * _volume(KEY_SFX))
	if _menu_music != null:
		_menu_music.set_user_gain(menu_music_gain())
	if _trailer_music != null:
		_trailer_music.set_user_gain(master_gain())

func music_gain() -> float:
	return _volume(KEY_MASTER) * _volume(KEY_MUSIC)

func menu_music_gain() -> float:
	return _volume(KEY_MASTER) * _volume(KEY_MENU_MUSIC)

## Menu music on the non-match screens (web App effect); a no-op while it already plays.
func play_menu_music() -> void:
	if _menu_music != null:
		return
	_menu_music = _start_music(MENU_MUSIC_BUS, _menu_arranger.arrange, MenuMusicArranger.FADE_IN_SEC, menu_music_gain())
	analysis.add_capture(_menu_music.capture())

func trailer_music() -> MusicEngine:
	return _trailer_music

## The trailer's own music (web TrailerMusic.start on the countdown's GO): straight in at the master volume alone
## (web TrailerScreen masterVolume); a no-op while it already plays.
func play_trailer_music() -> void:
	if _trailer_music != null:
		return
	_trailer_music = _start_music(TRAILER_MUSIC_BUS, _trailer_arranger.arrange, TrailerMusicArranger.FADE_IN_SEC,
		master_gain())

## web TrailerMusic.stop: the default fade with the echo ringing out, the session disposed after the tail.
func stop_trailer_music() -> void:
	if _trailer_music == null:
		return
	var engine := _trailer_music
	_trailer_music = null
	engine.fade_out()
	get_tree().create_timer(TRAILER_ECHO_TAIL_SEC).timeout.connect(engine.queue_free)

func master_gain() -> float:
	return _volume(KEY_MASTER)

func _start_music(bus_format: String, provider: Callable, fade_in_sec: float, gain: float) -> MusicEngine:
	_music_sessions += 1
	var engine := MusicEngine.new()
	engine.name = bus_format % _music_sessions
	engine.bus_prefix = bus_format % _music_sessions
	engine.setup(provider, fade_in_sec)
	add_child(engine)
	engine.set_user_gain(gain)
	engine.start()
	return engine

## Entering a match: a quick fade with no ring-out, then the session goes away (web MenuMusic.stop).
func stop_menu_music() -> void:
	if _menu_music == null:
		return
	var engine := _menu_music
	_menu_music = null
	_menu_arranger.reset()
	engine.fade_out(MenuMusicArranger.FADE_OUT_SEC, false)
	var capture := engine.capture()
	get_tree().create_timer(MenuMusicArranger.FADE_OUT_SEC).timeout.connect(func() -> void:
		analysis.remove_capture(capture)
		engine.queue_free())

## A room-code-like music seed for a local match (web randomRoomCode).
static func random_room_code(rng: Callable) -> String:
	return RoomCode.random(rng)

func _volume(key: String) -> float:
	return clampf(float(Game.profile.get(key, 1.0)), 0.0, 1.0)
