extends GutTest
## Who stands on the menu stage — web components/menuBalls computeBalls + menuStage STAGE_SPOTS: just you outside the
## lobby; in the lobby every seated player on its seat's spot, your own ball keeping the "player" key and your ring.

const PLAYER := {"color": "#ffaa44", "model": "smooth", "ring": "#44aaff", "art": ""}
const HOST := {"id": 0, "name": "PARITY7", "color": "#ffaa44", "kind": "human", "ballModel": "smooth", "reserveColor": "#338855"}
const BOT := {"id": 1, "name": "EX82R", "color": "#ffdd44", "kind": "bot", "ballModel": "waves", "reserveColor": "#dd4444"}
const FAR_BOT := {"id": 3, "name": "B3", "color": "#aa44ff", "kind": "bot", "ballModel": "smooth", "reserveColor": "#44aaff"}

func test_outside_the_lobby_only_you_stand() -> void:
	var balls := MenuStage.balls(MenuCameraRig.SCREEN_MENU, PLAYER, [HOST, BOT], 0)
	assert_eq(balls.size(), 1)
	assert_eq(balls[0]["key"], MenuStage.PLAYER_KEY)
	assert_eq(balls[0]["spot"], MenuStage.STAGE_SPOTS[0])
	assert_eq(balls[0]["spec"], PLAYER)

func test_the_lobby_seats_everyone_on_their_spot() -> void:
	var balls := MenuStage.balls(MenuCameraRig.SCREEN_LOBBY, PLAYER, [HOST, BOT, FAR_BOT], 0)
	assert_eq(balls.size(), 3)
	assert_eq(balls[0]["key"], MenuStage.PLAYER_KEY, "your own ball keeps its key (no re-fade)")
	assert_eq(balls[0]["spec"]["ring"], PLAYER["ring"], "and your live profile ring")
	assert_eq(balls[1]["key"], "slot-1")
	assert_eq(balls[1]["spot"], MenuStage.STAGE_SPOTS[1])
	assert_eq(balls[1]["spec"], {"color": "#ffdd44", "model": "waves", "ring": "#dd4444", "art": ""})
	assert_eq(balls[2]["spot"], MenuStage.STAGE_SPOTS[3], "seat 3: the square's back-left spot")

func test_a_client_before_assign_owns_the_host_placeholder() -> void:
	var balls := MenuStage.balls(MenuCameraRig.SCREEN_LOBBY, PLAYER, [HOST], 2)
	assert_eq(balls.size(), 1)
	assert_eq(balls[0]["key"], MenuStage.PLAYER_KEY)

func test_an_empty_lobby_falls_back_to_you() -> void:
	var balls := MenuStage.balls(MenuCameraRig.SCREEN_LOBBY, PLAYER, [], 0)
	assert_eq(balls.size(), 1)
	assert_eq(balls[0]["key"], MenuStage.PLAYER_KEY)
