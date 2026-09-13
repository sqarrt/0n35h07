extends Node
## Global audio (autoload, after Game) — web App's single SFX engine for menus and matches, the menu music and the sound
## analysis the HUD visualiser draws. Volumes follow the profile: master x effects for SFX, master x menu music for the
## menu, master x music for a match (the match owns its own MusicEngine).

const SFX_BUS := "Sfx"
const MENU_MUSIC_BUS := "MenuMusic%d"          # a fresh prefix per session: a fading session keeps its own buses
const CODE_ALPHABET := "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"   # web randomRoomCode: base-36, upper case
const CODE_LENGTH := 4                                           # web CODE_LEN
const KEY_MASTER := "volumeMaster"
const KEY_MUSIC := "volumeMusic"
const KEY_SFX := "volumeSfx"
const KEY_MENU_MUSIC := "volumeMenuMusic"

var analysis := AudioAnalysisHub.new()

var _sfx: SfxEngine
var _menu_rng := RandomNumberGenerator.new()   # web Math.random for the menu layers
var _menu_arranger: MenuMusicArranger
var _menu_music: MusicEngine
var _menu_sessions := 0

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

func play_ui(event: String) -> void:
	_sfx.play_2d(event)

## Re-read the profile volumes (web App effects on the volume sliders).
func apply_volumes() -> void:
	_sfx.set_user_gain(_volume(KEY_MASTER) * _volume(KEY_SFX))
	if _menu_music != null:
		_menu_music.set_user_gain(menu_music_gain())

func music_gain() -> float:
	return _volume(KEY_MASTER) * _volume(KEY_MUSIC)

func menu_music_gain() -> float:
	return _volume(KEY_MASTER) * _volume(KEY_MENU_MUSIC)

## Menu music on the non-match screens (web App effect); a no-op while it already plays.
func play_menu_music() -> void:
	if _menu_music != null:
		return
	_menu_sessions += 1
	_menu_music = MusicEngine.new()
	_menu_music.name = "MenuMusic%d" % _menu_sessions
	_menu_music.bus_prefix = MENU_MUSIC_BUS % _menu_sessions
	_menu_music.setup(_menu_arranger.arrange, MenuMusicArranger.FADE_IN_SEC)
	add_child(_menu_music)
	_menu_music.set_user_gain(menu_music_gain())
	_menu_music.start()
	analysis.add_capture(_menu_music.capture())

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
	var code := ""
	for i in CODE_LENGTH:
		code += CODE_ALPHABET[mini(CODE_ALPHABET.length() - 1, floori(rng.call() * CODE_ALPHABET.length()))]
	return code

func _volume(key: String) -> float:
	return clampf(float(Game.profile.get(key, 1.0)), 0.0, 1.0)
