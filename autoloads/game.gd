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

func _ready() -> void:
	random.randomize()
	if profile.is_empty():   # a tool may preset an in-memory profile before the autoloads get ready
		profile = ProfileStore.load_profile(random.randf)
	print("OneShot ", GAME_VERSION, " — Godot foundation ready")
