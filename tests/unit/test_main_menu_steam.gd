extends GutTest
## The Play screen's Steam flows (web App enterSteamFriendHost / enterSteamFriendClient / startSteamQuickMatch /
## onLobbyStopSearch / the invite listeners, and Lobby's picker and invites) on a fake Steam: PLAY hosts a Private lobby,
## a slow lobby shows the draft side, SEARCH hosts a Public lobby and STOP rebuilds the idle room with the draft
## selection, quick match joins as a guest, a picked friend waits on a seat until declining, the toast declines and
## accepts, "Join game" and the launch parameter join, and a guest whose host leaves hosts again.

const BRIDGE := preload("res://autoloads/steam_bridge.gd")
const FAKE := preload("res://tests/unit/fake_steam_api.gd")
const SCREEN := Vector2i(1280, 720)
const PEER := 200
const INVITER := 300
const FRIEND_LOBBY := 555
const FRIEND_ID := "76561190000000001"

var _fake
var _bridge

func before_each() -> void:
	_fake = FAKE.new()
	_bridge = BRIDGE.new()
	_bridge.api = _fake
	add_child_autofree(_bridge)

func after_each() -> void:
	Game.leave_room()

func _menu() -> MainMenu:
	var viewport := SubViewport.new()
	viewport.size = SCREEN
	add_child_autofree(viewport)
	var menu := (load("res://scenes/main_menu.tscn") as PackedScene).instantiate() as MainMenu
	menu.steam = _bridge
	menu.profile_saving = false
	viewport.add_child(menu)
	await wait_process_frames(2)
	return menu

func test_play_hosts_a_private_steam_lobby_and_back_leaves_it() -> void:
	var menu := await _menu()
	menu.open_lobby()
	assert_eq(_fake.created_public, [false], "friends get a Private lobby")
	var room := menu.lobby().room
	assert_true(room is RoomSession and room.is_host())
	assert_eq(Game.room, room)
	assert_true((room as RoomSession).net is SteamNet, "the lobby's SteamNet carries the room")
	menu.close_lobby()
	assert_eq(_fake.left, [_fake.NEW_LOBBY], "BACK leaves the lobby")
	assert_null(Game.room)

func test_a_forming_lobby_shows_my_side_and_the_picker_waits() -> void:
	_fake.respond = false
	var menu := await _menu()
	menu.open_lobby()
	assert_true(menu.lobby().room is DraftRoom, "no session yet")
	menu.lobby().invite_requested.emit()
	var picker := menu.find_child("FriendPicker", true, false) as SteamFriendPicker
	assert_not_null(picker)
	assert_true(picker.forming, "PREPARING LOBBY…")
	menu._process(SteamLobby.READY_TIMEOUT_S + 0.1)
	assert_true(menu.lobby().room is RoomSession, "after 8 s the room binds regardless")
	assert_false(picker.forming)

func test_search_hosts_a_public_lobby_and_stop_rebuilds_the_idle_room() -> void:
	var menu := await _menu()
	menu.open_lobby()
	var wished := [MapCatalog.MAP_IDS[1]]
	menu.lobby().map_wished.emit(wished)
	menu.lobby().search_requested.emit()
	assert_true(menu.lobby().searching)
	assert_true(menu.lobby().room is DraftRoom, "the idle room is gone while searching")
	assert_eq(_fake.left, [_fake.NEW_LOBBY], "the idle lobby was left")
	assert_eq(_fake.created_public, [false, true], "nothing found: host a Public lobby")
	menu.lobby().stop_requested.emit()
	assert_false(menu.lobby().searching)
	assert_eq(_fake.created_public, [false, true, false], "a Private lobby again")
	assert_true(menu.lobby().room is RoomSession and menu.lobby().room.is_host())
	assert_eq(menu.lobby().room.map_sel, wished, "the draft selection carries over (web draftSel)")

func test_quick_match_joins_the_lowest_lobby_as_a_guest() -> void:
	var menu := await _menu()
	menu.open_lobby()
	_fake.lobbies_found = [FRIEND_LOBBY]
	menu.lobby().search_requested.emit()
	assert_false(menu.lobby().searching, "paired: the names stop spinning")
	assert_eq(_fake.joined, [FRIEND_LOBBY])
	assert_false(menu.lobby().room.is_host())
	assert_eq(Game.room, menu.lobby().room)

func test_a_picked_friend_waits_on_a_seat_until_declining() -> void:
	_fake.friend_list = [{"id": int(FRIEND_ID), "name": "FRIEND", "online": true}]
	var menu := await _menu()
	menu.open_lobby()
	menu.lobby().invite_requested.emit()
	var picker := menu.find_child("FriendPicker", true, false) as SteamFriendPicker
	picker.picked.emit(FRIEND_ID, "FRIEND")
	assert_eq(_fake.invited, [[_fake.NEW_LOBBY, int(FRIEND_ID)]])
	assert_eq(menu.lobby().invites(), [{"id": FRIEND_ID, "name": "FRIEND"}])
	assert_eq(menu.lobby().action_kind(), LobbyState.ACTION_WAIT_FRIEND)
	await wait_process_frames(1)
	assert_null(menu.find_child("FriendPicker", true, false), "the picker closes")
	_bridge.invite_declined.emit(FRIEND_ID)
	assert_eq(menu.lobby().invites(), [])

func test_the_invite_toast_declines_and_accepts() -> void:
	_fake.names = {INVITER: "ALICE"}
	var menu := await _menu()
	_fake.lobby_invite.emit(INVITER, FRIEND_LOBBY)
	var toast := menu.find_child("InviteToast", true, false) as InviteToast
	assert_not_null(toast)
	assert_eq(toast.inviter_name, "ALICE")
	toast.declined.emit(str(INVITER))
	assert_eq(_fake.sent.back(), [INVITER, _bridge.DECLINE_MARKER], "the host's waiting seat frees")
	await wait_process_frames(1)
	assert_null(menu.find_child("InviteToast", true, false))
	_fake.lobby_invite.emit(INVITER, FRIEND_LOBBY)
	(menu.find_child("InviteToast", true, false) as InviteToast).accepted.emit(str(FRIEND_LOBBY))
	assert_not_null(menu.lobby(), "accepting opens the Play screen")
	assert_eq(_fake.joined, [FRIEND_LOBBY])
	assert_false(menu.lobby().room.is_host(), "as the guest")

func test_the_launch_parameter_joins_once_per_launch() -> void:
	_fake.command_line = "game.exe +connect_lobby %d" % FRIEND_LOBBY
	var menu := await _menu()
	assert_eq(_fake.joined, [FRIEND_LOBBY], "launched by an accepted invite")
	assert_not_null(menu.lobby())
	menu.get_parent().free()
	await _menu()
	assert_eq(_fake.joined, [FRIEND_LOBBY], "the menu after a match does not join again")

func test_join_game_from_the_friends_list() -> void:
	_fake.join_requested.emit(FRIEND_LOBBY)             # during a match: no menu listens
	var menu := await _menu()
	assert_eq(_fake.joined, [FRIEND_LOBBY], "taken once the menu is back")
	_fake.join_requested.emit(FRIEND_LOBBY + 1)
	assert_eq(_fake.joined, [FRIEND_LOBBY, FRIEND_LOBBY + 1])
	assert_false(menu.lobby().room.is_host())

func test_a_guest_whose_host_leaves_hosts_again() -> void:
	_fake.members[FRIEND_LOBBY] = [PEER]
	var menu := await _menu()
	_fake.join_requested.emit(FRIEND_LOBBY)
	assert_false(menu.lobby().room.is_host())
	_fake.lobby_member_changed.emit(FRIEND_LOBBY, PEER, false)
	assert_true(menu.lobby().room is RoomSession and menu.lobby().room.is_host(), "web onClosed: an idle hosted room")
	assert_eq(_fake.created_public, [false])
