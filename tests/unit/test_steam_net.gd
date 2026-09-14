extends GutTest
## SteamNet parity with web tests/unit/SteamNet.test.ts: peers from the lobby events, the {tag, data} envelope, our own
## and malformed packets dropped, leave, and JSON's whole numbers coming back as ints.

const SELF := "100"
const PEER := "200"
const THIRD := "300"
const LOBBY := "L"
const TAG := "snap"

var _sent: Array = []
var _left := false

func before_each() -> void:
	_sent = []
	_left = false

func _net() -> SteamNet:
	return SteamNet.new(SELF, func(to: String, data: String) -> void: _sent.append([to, data]),
		func() -> void: _left = true)

func test_lobby_events_track_the_peers() -> void:
	var net := _net()
	var joined: Array = []
	var left: Array = []
	net.on_peer_join(func(peer: String) -> void: joined.append(peer))
	net.on_peer_leave(func(peer: String) -> void: left.append(peer))
	net.handle_event({"kind": "lobbyEntered", "lobbyId": LOBBY, "self": SELF, "members": [SELF, PEER]})
	assert_eq(net.peers(), [PEER])
	assert_eq(joined, [PEER], "seeding from lobbyEntered fires join")
	net.handle_event({"kind": "peerJoin", "steamId": THIRD})
	assert_eq(net.peers(), [PEER, THIRD])
	net.handle_event({"kind": "peerLeave", "steamId": PEER})
	assert_eq(net.peers(), [THIRD])
	assert_eq(left, [PEER])
	net.handle_event({"kind": "peerJoin", "steamId": SELF})
	assert_eq(net.peers(), [THIRD], "never ourselves")

func test_messages_travel_in_a_tagged_envelope() -> void:
	var net := _net()
	net.handle_event({"kind": "lobbyEntered", "lobbyId": LOBBY, "self": SELF, "members": [SELF, PEER]})
	net.broadcast(TAG, {"x": 1})
	assert_eq(_sent, [[PEER, JSON.stringify({"tag": TAG, "data": {"x": 1}})]])
	_sent.clear()
	net.send(PEER, TAG, [1, 2])
	assert_eq(_sent, [[PEER, JSON.stringify({"tag": TAG, "data": [1, 2]})]])

func test_incoming_messages_reach_their_handlers() -> void:
	var net := _net()
	var got: Array = []
	net.on(TAG, func(payload, from: String) -> void: got.append([payload, from]))
	net.handle_event({"kind": "message", "from": PEER, "data": JSON.stringify({"tag": TAG, "data": {"hp": 3, "at": 1.5}})})
	assert_eq(got, [[{"hp": 3, "at": 1.5}, PEER]])
	assert_eq(typeof(got[0][0]["hp"]), TYPE_INT, "whole numbers come back as ints")
	net.handle_event({"kind": "message", "from": SELF, "data": JSON.stringify({"tag": TAG, "data": 1})})
	net.handle_event({"kind": "message", "from": PEER, "data": "not json"})
	assert_eq(got.size(), 1, "our own echo and malformed payloads are dropped")

func test_leave_leaves_the_lobby_and_forgets_the_peers() -> void:
	var net := _net()
	var unlistened := [false]
	net.set_unlisten(func() -> void: unlistened[0] = true)
	net.handle_event({"kind": "lobbyEntered", "lobbyId": LOBBY, "self": SELF, "members": [SELF, PEER]})
	net.leave()
	assert_true(_left)
	assert_true(unlistened[0])
	assert_eq(net.peers(), [])
