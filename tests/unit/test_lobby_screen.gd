extends GutTest
## Lobby screen parity with web screens/Lobby in the menu panel: the sections and their places (measured on the web
## frame: body 542.4 px, READY at 548.8, BACK at 605.6, title / carousel / map / time / players rows), the map, time and
## mode pickers, seats per mode, and READY starting the match through the room.

const EPS := 0.6
const SCREEN := Vector2i(1280, 720)
const PANEL_CONTENT := Vector2(626.0, 656.0)   # 598 px column + the 28 px scrollbar bleed
const PROFILE := {"name": "PARITY7", "primaryColor": "#fa4", "reserveColor": "#4af"}

var _requested: Array = []

func _lobby() -> LobbyScreen:
	_requested = []
	var viewport := SubViewport.new()
	viewport.size = SCREEN
	add_child_autofree(viewport)
	var rng := func() -> float: return 0.0
	var room := RoomModel.new(PlayerProfile.sanitize(PROFILE, rng), rng)
	var lobby := LobbyScreen.new()
	lobby.setup(room, rng)
	viewport.add_child(lobby)
	lobby.size = PANEL_CONTENT
	lobby.match_requested.connect(func(setup: Dictionary) -> void: _requested.append(setup))
	await wait_process_frames(3)
	return lobby

func _node(lobby: LobbyScreen, node_name: String) -> Control:
	return lobby.find_child(node_name, true, false) as Control

func test_sections_sit_where_the_web_puts_them() -> void:
	var lobby := await _lobby()
	assert_eq((_node(lobby, "Title") as Label).text, "PLAY")
	assert_almost_eq(_node(lobby, "Body").size.y, 542.4, EPS, "the body above READY and BACK")
	assert_almost_eq(_node(lobby, "Ready").global_position.y, 548.8, EPS)
	assert_almost_eq(_node(lobby, "Back").global_position.y, 605.6, EPS)
	assert_almost_eq(_node(lobby, "Ready").size.x, 598.0, EPS, "full column width")
	assert_almost_eq(_node(lobby, "Title").position.y, 14.4, EPS, "padding-top 2vh")
	assert_almost_eq(_node(lobby, "Modes").position.y, 57.4, EPS)
	assert_almost_eq(_node(lobby, "MapLabel").position.y, 163.4, EPS)
	assert_almost_eq(_node(lobby, "Map_os_arena").position.y, 194.4, EPS)
	assert_almost_eq(_node(lobby, "Map_os_arena").size.x, 194.0, EPS)
	assert_almost_eq(_node(lobby, "TimeLabel").position.y, 634.4, EPS)
	assert_almost_eq(_node(lobby, "Time3").position.y, 665.4, EPS)
	assert_almost_eq(_node(lobby, "PlayersLabel").position.y, 708.4, EPS)
	assert_almost_eq(_node(lobby, "Seats").position.y, 739.4, EPS)
	assert_almost_eq(_node(lobby, "Seat0").position.x, 12.48, EPS, "two 44% seats and VS centred, 16 px apart")

func test_a_fresh_room() -> void:
	var lobby := await _lobby()
	assert_true((_node(lobby, "Map_os_arena") as MapTile).is_on())
	assert_true((_node(lobby, "Time3") as SegButton).is_on())
	assert_eq(lobby.seats().size(), 2)
	assert_not_null(lobby.seats()[1].find_child("AddBot", true, false), "the free seat offers a bot")
	assert_true((_node(lobby, "Ready") as UiButton).disabled, "a lone host can't start")
	assert_eq((_node(lobby, "Back") as UiButton).text, "BACK")

func test_a_bot_enables_ready_and_ready_starts() -> void:
	var lobby := await _lobby()
	(lobby.seats()[1].find_child("AddBot", true, false) as Button).pressed.emit()
	assert_eq(lobby.room.slots[1]["kind"], "bot")
	assert_false((_node(lobby, "Ready") as UiButton).disabled)
	assert_eq((_node(lobby, "Back") as UiButton).text, "LEAVE")
	(_node(lobby, "Ready") as UiButton).pressed.emit()
	assert_eq(_requested.size(), 1, "every seat ready: the match starts")

func test_team_modes_start_once_their_gate_holds() -> void:
	var lobby := await _lobby()
	lobby.room.set_mode(GameModes.BATTLE)
	for slot in [1, 2]:
		lobby.room.add_bot(slot)
	assert_true((_node(lobby, "Ready") as UiButton).disabled, "2v2 waits for full teams")
	lobby.room.add_bot(3)
	assert_false((_node(lobby, "Ready") as UiButton).disabled, "full teams: READY")

func test_pickers_drive_the_room() -> void:
	var lobby := await _lobby()
	(_node(lobby, "Map_os_india") as MapTile).pressed.emit()
	assert_eq(lobby.room.map_sel, ["os_india"], "single choice replaces the selection")
	(_node(lobby, "SelectAll") as SegButton).pressed.emit()
	assert_eq(lobby.room.map_sel, MapCatalog.MAP_IDS, "select all turns multi on")
	assert_true((_node(lobby, "Multi") as SegButton).is_on())
	(_node(lobby, "Multi") as SegButton).pressed.emit()
	assert_eq(lobby.room.map_sel, ["os_arena"], "multi off keeps the first")
	(_node(lobby, "Time10") as SegButton).pressed.emit()
	assert_eq(lobby.room.duration_sel, [10])
	(_node(lobby, "Modes") as ModeCarousel).mode_picked.emit(GameModes.BATTLE)
	assert_eq(lobby.seats().size(), 4, "Battle: four seats")
