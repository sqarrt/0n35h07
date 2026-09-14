class_name SteamPresence
## Steam Rich Presence per screen — port of web src/steam/richPresence.ts: `steam_display` takes a localization token
## (defined in the partner portal) for the lobby, the match, or the menu for every other screen.

const STATUS_KEY := "steam_display"
const TOKEN_MENU := "#Status_InMenu"
const TOKEN_LOBBY := "#Status_InLobby"
const TOKEN_MATCH := "#Status_InMatch"
const SCREEN_MENU := "menu"
const SCREEN_LOBBY := "lobby"
const SCREEN_GAME := "game"

static func token_for(screen: String) -> String:
	match screen:
		SCREEN_LOBBY:
			return TOKEN_LOBBY
		SCREEN_GAME:
			return TOKEN_MATCH
	return TOKEN_MENU

## Show `screen` in the friends list through the Steam bridge (a no-op without Steam).
static func apply(bridge: Object, screen: String) -> void:
	bridge.set_rich_presence(STATUS_KEY, token_for(screen))
