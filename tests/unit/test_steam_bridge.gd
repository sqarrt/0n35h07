extends GutTest
## The Steam bridge (web src-tauri steam_net.rs pump + steam.ts) on a fake Steam: nothing without Steam, one lobbyEntered
## per lobby with its members, joinable + Rich Presence, member changes, the message pump and the decline marker,
## sessions accepted, the invite launch parameter, the friend order and leaving.

const BRIDGE := preload("res://autoloads/steam_bridge.gd")
const FAKE := preload("res://tests/unit/fake_steam_api.gd")
const PEER := 200
const INVITER := 300
const OTHER_LOBBY := 777

var _events: Array = []

func before_each() -> void:
	_events = []

func _bridge(up := true) -> Array:
	var fake = FAKE.new()
	fake.up = up
	var bridge = BRIDGE.new()
	bridge.api = fake
	add_child_autofree(bridge)
	bridge.net_event.connect(func(event: Dictionary) -> void: _events.append(event))
	return [bridge, fake]

func test_without_steam_nothing_happens() -> void:
	var made := _bridge(false)
	var bridge = made[0]
	assert_false(bridge.available())
	assert_eq(bridge.self_id(), "")
	assert_false(bridge.invite_to_lobby(str(PEER)), "no lobby, no Steam")

func test_a_created_lobby_is_entered_once_and_joinable() -> void:
	var made := _bridge()
	var bridge = made[0]
	var fake = made[1]
	bridge.create_lobby()
	assert_eq(_events.size(), 1, "created and joined report the same lobby")
	assert_eq(_events[0], {"kind": "lobbyEntered", "lobbyId": str(fake.NEW_LOBBY), "self": str(fake.steam_id),
		"members": [str(fake.steam_id)]})
	assert_true(fake.joinable[fake.NEW_LOBBY])
	assert_eq(fake.presence[bridge.RP_CONNECT_KEY], str(fake.NEW_LOBBY), "friends see us as joinable")

func test_a_started_match_seals_the_lobby() -> void:
	# A friend joining a match already under way could be let in and then never seated — Steam turns them away instead.
	var made := _bridge()
	var bridge = made[0]
	var fake = made[1]
	bridge.create_lobby()
	bridge.seal_lobby()
	assert_false(fake.joinable[fake.NEW_LOBBY])

func test_member_changes_become_peer_events() -> void:
	var made := _bridge()
	var bridge = made[0]
	var fake = made[1]
	bridge.create_lobby()
	fake.lobby_member_changed.emit(fake.NEW_LOBBY, PEER, true)
	fake.lobby_member_changed.emit(OTHER_LOBBY, INVITER, true)
	fake.lobby_member_changed.emit(fake.NEW_LOBBY, PEER, false)
	assert_eq(_events.slice(1), [{"kind": "peerJoin", "steamId": str(PEER)}, {"kind": "peerLeave", "steamId": str(PEER)}],
		"only our lobby's members")

func test_the_pump_delivers_messages_and_declines() -> void:
	var made := _bridge()
	var bridge = made[0]
	var fake = made[1]
	watch_signals(bridge)
	fake.inbox = [{"from": PEER, "data": "{}"}, {"from": INVITER, "data": bridge.DECLINE_MARKER}]
	bridge._process(0.0)
	assert_eq(_events, [{"kind": "message", "from": str(PEER), "data": "{}"}])
	assert_signal_emitted_with_parameters(bridge, "invite_declined", [str(INVITER)])
	fake.session_requested.emit(PEER)
	assert_eq(fake.accepted, [PEER], "incoming sessions are accepted")

func test_invites_and_join_requests() -> void:
	var made := _bridge()
	var bridge = made[0]
	var fake = made[1]
	watch_signals(bridge)
	fake.names[INVITER] = "FRIEND"
	fake.lobby_invite.emit(INVITER, OTHER_LOBBY)
	assert_signal_emitted_with_parameters(bridge, "invite_received", ["FRIEND", str(INVITER), str(OTHER_LOBBY)])
	fake.join_requested.emit(OTHER_LOBBY)
	assert_eq(_events.back(), {"kind": "joinRequested", "lobbyId": str(OTHER_LOBBY)})
	assert_true(bridge.decline_invite(str(INVITER)))
	assert_eq(fake.sent.back(), [INVITER, bridge.DECLINE_MARKER])

func test_the_launch_parameter_names_a_lobby() -> void:
	assert_eq(BRIDGE.parse_connect_lobby("game.exe +connect_lobby 109775241234 -x"), "109775241234")
	assert_eq(BRIDGE.parse_connect_lobby("game.exe +connect_lobby abc"), "", "digits only")
	assert_eq(BRIDGE.parse_connect_lobby("game.exe"), "")

func test_friends_online_first_then_by_name() -> void:
	var made := _bridge()
	var bridge = made[0]
	var fake = made[1]
	fake.friend_list = [{"id": 1, "name": "zed", "online": false}, {"id": 2, "name": "Bob", "online": true},
		{"id": 3, "name": "alice", "online": true}]
	assert_eq(bridge.friends().map(func(f: Dictionary) -> String: return f["name"]), ["alice", "Bob", "zed"])

func test_leaving_clears_the_lobby_and_presence() -> void:
	var made := _bridge()
	var bridge = made[0]
	var fake = made[1]
	bridge.create_lobby()
	bridge.leave_lobby()
	assert_eq(fake.left, [fake.NEW_LOBBY])
	assert_eq(bridge.lobby_id, 0)
	assert_eq(fake.presence[bridge.RP_CONNECT_KEY], "", "no longer joinable")
