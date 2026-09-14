extends GutTest
## Steam friend lobbies (web steam/SteamLobby) and quick match (web steam/SteamQuickMatch) on the bridge over a fake
## Steam: a hosted or joined lobby hands over its SteamNet, a silent Steam times out, no Steam means no lobby; quick match
## joins the lowest lobby, hosts when there is none, resolves a simultaneous create and stops.

const BRIDGE := preload("res://autoloads/steam_bridge.gd")
const FAKE := preload("res://tests/unit/fake_steam_api.gd")
const PEER := 200
const FRIEND_LOBBY := 555
const HIGHER_LOBBY := 999

var _matched: Array = []
var _entered: Array = []

func before_each() -> void:
	_matched = []
	_entered = []

func _bridge(up := true) -> Array:
	var fake = FAKE.new()
	fake.up = up
	var bridge = BRIDGE.new()
	bridge.api = fake
	add_child_autofree(bridge)
	return [bridge, fake]

func _on_entered(net: SteamNet) -> void:
	_entered.append(net)

func test_a_hosted_lobby_hands_over_its_net() -> void:
	var made := _bridge()
	var lobby := SteamLobby.host(made[0])
	assert_eq(made[1].created_public, [false], "friends get a Private lobby")
	assert_false(lobby.is_waiting(), "Steam answered at once")
	lobby.entered.connect(_on_entered)
	var joined := SteamLobby.join(made[0], str(FRIEND_LOBBY))
	assert_not_null(joined)
	assert_eq(made[1].joined, [FRIEND_LOBBY])

func test_joining_sees_the_members_already_there() -> void:
	var made := _bridge()
	made[1].members[FRIEND_LOBBY] = [PEER]
	var lobby := SteamLobby.join(made[0], str(FRIEND_LOBBY))
	assert_eq(lobby.net.peers(), [str(PEER)])

func test_a_silent_steam_times_out() -> void:
	var made := _bridge()
	made[1].respond = false
	var lobby := SteamLobby.host(made[0])
	lobby.entered.connect(_on_entered)
	lobby.tick(SteamLobby.READY_TIMEOUT_S * 0.5)
	assert_eq(_entered.size(), 0)
	lobby.tick(SteamLobby.READY_TIMEOUT_S)
	assert_eq(_entered.size(), 1, "the screen never hangs")

func test_no_steam_no_lobby() -> void:
	var made := _bridge(false)
	assert_null(SteamLobby.host(made[0]))
	assert_false(SteamQuickMatch.new().start(made[0]))

func _quick(made: Array) -> SteamQuickMatch:
	var quick := SteamQuickMatch.new()
	quick.matched.connect(func(net: SteamNet, role: String) -> void: _matched.append([net, role]))
	assert_true(quick.start(made[0]))
	return quick

func test_quick_match_joins_the_lowest_lobby() -> void:
	var made := _bridge()
	made[1].lobbies_found = [HIGHER_LOBBY, FRIEND_LOBBY]
	_quick(made)
	assert_eq(_matched.size(), 1)
	assert_eq(_matched[0][1], RoomSession.ROLE_CLIENT)
	assert_eq(made[1].joined, [FRIEND_LOBBY])

func test_quick_match_hosts_and_waits_for_a_peer() -> void:
	var made := _bridge()
	var quick := _quick(made)
	assert_eq(made[1].created_public, [true], "nothing found: host a Public lobby")
	assert_true(quick.is_searching())
	made[1].lobby_member_changed.emit(made[1].NEW_LOBBY, PEER, true)
	assert_eq(_matched.size(), 1)
	assert_eq(_matched[0][1], RoomSession.ROLE_HOST)
	assert_eq((_matched[0][0] as SteamNet).peers(), [str(PEER)])

func test_a_simultaneous_create_goes_to_the_lower_lobby() -> void:
	var made := _bridge()
	var quick := _quick(made)                        # hosts NEW_LOBBY (900)
	made[1].lobbies_found = [made[1].NEW_LOBBY, FRIEND_LOBBY]
	quick.tick(SteamQuickMatch.RESEARCH_S)
	assert_eq(made[1].left, [made[1].NEW_LOBBY], "our higher lobby is abandoned")
	assert_eq(_matched[0][1], RoomSession.ROLE_CLIENT)
	assert_eq(made[1].joined, [FRIEND_LOBBY])

func test_stop_leaves_without_a_match() -> void:
	var made := _bridge()
	var quick := _quick(made)
	quick.stop()
	assert_false(quick.is_searching())
	made[1].lobby_member_changed.emit(made[1].NEW_LOBBY, PEER, true)
	assert_eq(_matched.size(), 0)
	assert_eq(made[1].left, [made[1].NEW_LOBBY])
