extends Node
## Global game root (autoload). Stub host for the future OneShot simulation.
## No gameplay yet — later sub-projects grow the Match/world here.

const GAME_VERSION := "2.0.0"

var selected_map := MapCatalog.raw_path(MapCatalog.MAP_IDS[0])   # set by the lobby (web handlePlay: MAP_IDS[0])
var match_duration_ms := MatchConst.LOBBY_DEFAULT_DURATION_MS   # set by the lobby (3 / 5 / 10 min)
var random := RandomNumberGenerator.new()          # names and first-run profile rolls (web Math.random)
var profile := {}                                  # the local player's PlayerProfile (web loadProfile)
var lobby_bot_name := ""                           # the host's name for the bot; "" = generated (web setBotName)
var lobby_roster: Array = []                       # the lobby's seats at the start (web RoomSession roster); [] = tools
var lobby_mode := GameModes.DUEL                   # the lobby preset those seats were taken under
var warning_seen := false                          # web App showWarning: the warning splash shows once per launch
var menu_screen := ""                              # the menu screen to reopen when the menu scene loads again ("about")
var room: RoomSession = null                       # the lobby's room while it's open and through its match (web sessionRef)
var match_setup := {}                              # the room's START: owners, spawns, local id, seed, peer; {} = tools

var log_sink: GameLogSink = null                  # the Steam build's session log file (web logSink); null elsewhere

const LOCAL_PEER := "local"                        # the transport id of a room nobody else has joined (web selfPeer)
const CLIENT_PLATFORM := "desktop"                 # web CLIENT_PLATFORM on the Steam build

## Leave the room: its transport closes and the match facts go (web leaveRoom).
func leave_room() -> void:
	if room != null:
		room.dispose()
	room = null
	match_setup = {}

## web installGameLog: the session file, its header and the engine's uncaught errors (the sink flushes on the way out).
func _start_game_log() -> void:
	log_sink = GameLogSink.new()
	log_sink.name = "GameLogSink"
	if NetDiag.is_on(OS.get_cmdline_args()):   # several windows share one user://: give each its own folder
		log_sink.setup(NetDiag.dir_for(OS.get_process_id()))
	add_child(log_sink)
	GameLog.install(log_sink)
	OS.add_logger(GameLogErrors.new())
	GameLog.log("life", "session_start", {"version": GAME_VERSION, "appId": SteamApi.APP_ID, "platform": CLIENT_PLATFORM,
		"engine": Engine.get_version_info()["string"]})

func _ready() -> void:
	DisplayStartup.start(get_tree().root, OS.get_cmdline_args(), DisplayServer.screen_get_dpi())
	random.randomize()
	var cloud := SteamBridge.available() and not DisplayStartup.is_tool_run(OS.get_cmdline_args())
	# web installGameLog: the session log exists on the Steam build — and on a network test run, whatever Steam says.
	if cloud or NetDiag.is_on(OS.get_cmdline_args()):
		_start_game_log()
	if profile.is_empty():   # a tool may preset an in-memory profile before the autoloads get ready
		if cloud:   # web main.tsx: reconcile with Steam Cloud before the profile is read
			ProfileCloud.sync_on_startup(SteamBridge, random.randf)
		profile = ProfileStore.load_profile(random.randf)
	if cloud:   # web installProfileCloudSync, after the reconcile so an adopted profile doesn't echo back
		var pusher := ProfileCloudPusher.new()
		pusher.name = "ProfileCloudPusher"
		pusher.setup(SteamBridge)
		add_child(pusher)
		ProfileStore.save_hook = pusher.queue
	I18n.use_locale(Locales.of_profile(profile))   # web App: profile.locale ?? detectLocale()
	print("OneShot ", GAME_VERSION, " — Godot foundation ready")
