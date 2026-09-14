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

const LOCAL_PEER := "local"                        # the transport id of a room nobody else has joined (web selfPeer)

## Leave the room: its transport closes and the match facts go (web leaveRoom).
func leave_room() -> void:
	if room != null:
		room.dispose()
	room = null
	match_setup = {}

func _ready() -> void:
	random.randomize()
	if profile.is_empty():   # a tool may preset an in-memory profile before the autoloads get ready
		profile = ProfileStore.load_profile(random.randf)
	I18n.use_locale(Locales.of_profile(profile))   # web App: profile.locale ?? detectLocale()
	print("OneShot ", GAME_VERSION, " — Godot foundation ready")
