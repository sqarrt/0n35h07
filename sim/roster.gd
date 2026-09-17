class_name Roster extends RefCounted
## Who plays the match — port of the web RosterEntry list (net/protocol.ts): a human entry comes from the profile
## (RoomSession.helloEntry), a bot entry from its name (makeBotEntry: the name seeds both look and personality).
## The HUD, streak effects and the result screen read names and colours from here.

const KIND_HUMAN := "human"
const KIND_BOT := "bot"
const APPEARANCE_KEYS := ["reserveColor", "ballModel", "windupStyle", "respawnStyle", "dashStyle", "shieldStyle"]

var _entries: Array = []

static func human_entry(id: int, profile: Dictionary) -> Dictionary:
	var entry := {"id": id, "name": profile["name"], "kind": KIND_HUMAN, "color": profile["primaryColor"]}
	for key in APPEARANCE_KEYS:
		entry[key] = profile[key]
	if profile.has("ballArt"):
		entry["ballArt"] = profile["ballArt"]
	return entry

static func bot_entry(id: int, bot_name: String, difficulty: String) -> Dictionary:
	var skin := BotAppearance.from_name(bot_name)
	var entry := {"id": id, "name": bot_name, "kind": KIND_BOT, "difficulty": difficulty, "color": skin["color"]}
	for key in APPEARANCE_KEYS:
		entry[key] = skin[key]
	return entry

func add(entry: Dictionary) -> void:
	_entries.append(entry)

func entries() -> Array:
	return _entries

func entry(id: int) -> Dictionary:
	for e in _entries:
		if e["id"] == id:
			return e
	return {}

## The first entry that is not `local_id` (1v1: the opponent), {} when alone.
func opponent_of(local_id: int) -> Dictionary:
	for e in _entries:
		if e["id"] != local_id:
			return e
	return {}

func name_of(id: int) -> String:
	return entry(id).get("name", "")

## The player's colour; `fallback` for ids without an entry.
func color_of(id: int, fallback := AppearanceConst.FALLBACK_TEXT_COLOR) -> Color:
	return Color(entry(id).get("color", fallback))
