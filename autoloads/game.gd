extends Node
## Global game root (autoload). Stub host for the future OneShot simulation.
## No gameplay yet — later sub-projects grow the Match/world here.

const GAME_VERSION := "2.0.0"

## Selectable maps: [display name, resource path]. Order is stable for the menu picker.
const MAPS := [
	["Pillars", "res://maps/os_pillars.json"],
	["Arena", "res://maps/os_arena.json"],
	["India", "res://maps/os_india.json"],
	["Pool", "res://maps/os_pool_day.json"],
]

var selected_map := "res://maps/os_pillars.json"   # set by the main menu
var match_duration_ms := MatchConst.LOBBY_DEFAULT_DURATION_MS   # set by the lobby (3 / 5 / 10 min)
var random := RandomNumberGenerator.new()          # names and first-run profile rolls (web Math.random)
var profile := {}                                  # the local player's PlayerProfile (web loadProfile)
var lobby_bot_name := ""                           # the host's name for the bot; "" = generated (web setBotName)

func _ready() -> void:
	random.randomize()
	profile = ProfileStore.load_profile(random.randf)
	print("OneShot ", GAME_VERSION, " — Godot foundation ready")
