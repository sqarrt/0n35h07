class_name SteamNet extends RefCounted
## INet over Steam — port of web net/SteamNet: the peers are the other lobby members, and messages travel point to point
## over Steam NetworkingMessages (reliable, one channel) as a {tag, data} JSON envelope; a broadcast fans out to every
## member. The lobby controller (SteamLobby / SteamQuickMatch) drives the lobby itself; this class only tracks the peers
## from the Steam event stream and routes messages by tag. Sending and leaving the lobby are injected, so the transport
## runs without Steam in tests.

const KIND_MESSAGE := "message"
const KIND_PEER_JOIN := "peerJoin"
const KIND_PEER_LEAVE := "peerLeave"
const KIND_LOBBY_ENTERED := "lobbyEntered"

var self_id: String

var _send: Callable                              # (to: String, data: String) -> void
var _leave_lobby: Callable                       # () -> void
var _handlers := {}                              # tag -> Array[Callable(payload, from)]
var _join_cbs: Array[Callable] = []
var _leave_cbs: Array[Callable] = []
var _peers: Array[String] = []
var _unlisten := Callable()

## `id`: our SteamID64 as a string; `send`: deliver a string to a member; `leave_lobby`: leave the Steam lobby.
func _init(id: String, send: Callable, leave_lobby: Callable) -> void:
	self_id = id
	_send = send
	_leave_lobby = leave_lobby

## Feed one Steam event (the bridge's event stream; tests call it directly).
func handle_event(event: Dictionary) -> void:
	match String(event.get("kind", "")):
		KIND_LOBBY_ENTERED:
			_peers.clear()
			for member in event.get("members", []):
				if String(member) != self_id:
					_add_peer(String(member))
		KIND_PEER_JOIN:
			if String(event.get("steamId", "")) != self_id:
				_add_peer(String(event["steamId"]))
		KIND_PEER_LEAVE:
			_remove_peer(String(event.get("steamId", "")))
		KIND_MESSAGE:
			var from := String(event.get("from", ""))
			if from == self_id:
				return                              # never deliver our own packet to ourselves
			var json := JSON.new()                  # parse() reports bad input quietly (parse_string logs an error)
			if json.parse(String(event.get("data", ""))) != OK:
				return                              # ignore malformed
			var envelope = json.data
			if not envelope is Dictionary or not envelope.has("tag"):
				return
			for cb in _handlers.get(String(envelope["tag"]), []):
				cb.call(whole_numbers(envelope.get("data")), from)
		# joinRequested / mmResult belong to the lobby controller, not the transport

## Detach the bridge listener when the transport leaves.
func set_unlisten(cb: Callable) -> void:
	_unlisten = cb

func broadcast(tag: String, payload) -> void:
	var data := JSON.stringify({"tag": tag, "data": payload})
	for peer in _peers:
		_send.call(peer, data)

func send(peer_id: String, tag: String, payload) -> void:
	_send.call(peer_id, JSON.stringify({"tag": tag, "data": payload}))

func on(tag: String, cb: Callable) -> void:
	var list: Array = _handlers.get(tag, [])
	list.append(cb)
	_handlers[tag] = list

func on_peer_join(cb: Callable) -> void:
	_join_cbs.append(cb)

func on_peer_leave(cb: Callable) -> void:
	_leave_cbs.append(cb)

func peers() -> Array:
	return _peers.duplicate()

func leave() -> void:
	_leave_lobby.call()
	if _unlisten.is_valid():
		_unlisten.call()
	_unlisten = Callable()
	_handlers.clear()
	_peers.clear()

## JSON has one number type: whole numbers come back as ints (ids, seats, minutes), like the web's single number type,
## so player-id keys and comparisons match what the sender had.
static func whole_numbers(value):
	if value is float and is_finite(value) and value == floorf(value):
		return int(value)
	if value is Array:
		return value.map(func(item): return whole_numbers(item))
	if value is Dictionary:
		var out := {}
		for key in value:
			out[key] = whole_numbers(value[key])
		return out
	return value

func _add_peer(id: String) -> void:
	if _peers.has(id):
		return
	_peers.append(id)
	for cb in _join_cbs:
		cb.call(id)

func _remove_peer(id: String) -> void:
	if not _peers.has(id):
		return
	_peers.erase(id)
	for cb in _leave_cbs:
		cb.call(id)
