extends GutTest
## SteamPresence — port of web tests/unit/richPresence.test.ts: the friends-list status token for each screen.

func test_the_lobby_and_the_match() -> void:
	assert_eq(SteamPresence.token_for(SteamPresence.SCREEN_LOBBY), SteamPresence.TOKEN_LOBBY)
	assert_eq(SteamPresence.token_for(SteamPresence.SCREEN_GAME), SteamPresence.TOKEN_MATCH)
	assert_eq(SteamPresence.TOKEN_LOBBY, "#Status_InLobby")
	assert_eq(SteamPresence.TOKEN_MATCH, "#Status_InMatch")

func test_every_other_screen_is_the_menu() -> void:
	for screen in ["menu", "settings", "appearance", "about", "trailer", "radio"]:
		assert_eq(SteamPresence.token_for(screen), SteamPresence.TOKEN_MENU, screen)
	assert_eq(SteamPresence.TOKEN_MENU, "#Status_InMenu")
	assert_eq(SteamPresence.STATUS_KEY, "steam_display")
