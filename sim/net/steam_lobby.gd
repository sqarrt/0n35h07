class_name SteamLobby extends RefCounted
## A Steam lobby for friends — port of web steam/SteamLobby: host a Private lobby or join one by id, and hand over a
## SteamNet wired to the bridge's event stream once the lobby is entered (or after 8 s regardless, so the screen never
## hangs). Without Steam there is no lobby (host / join return null). `tick` runs the wait.

signal entered(net: SteamNet)                  # web: the awaited ready SteamNet

const READY_TIMEOUT_S := 8.0                   # web LOBBY_READY_TIMEOUT_MS
const KIND_LOBBY_ENTERED := "lobbyEntered"

var net: SteamNet

var _bridge
var _waiting := true
var _left := READY_TIMEOUT_S

## Host a Private lobby friends are invited into (web hostFriendLobby).
static func host(bridge) -> SteamLobby:
	var lobby := SteamLobby.new(bridge)
	if lobby.net == null:
		return null
	bridge.create_lobby(false)
	return lobby

## Join a friend's lobby (an invite, "Join game", the launch parameter) (web joinSteamLobby).
static func join(bridge, lobby_id: String) -> SteamLobby:
	var lobby := SteamLobby.new(bridge)
	if lobby.net == null:
		return null
	bridge.join_lobby(lobby_id)
	return lobby

func _init(bridge) -> void:
	_bridge = bridge
	net = SteamNetWiring.wire(bridge)
	if net != null:
		bridge.net_event.connect(_on_event)

## The wait for the lobby: after READY_TIMEOUT_S the net is handed over as it is.
func tick(delta: float) -> void:
	if not _waiting:
		return
	_left -= delta
	if _left <= 0.0:
		_finish()

func is_waiting() -> bool:
	return _waiting

func _on_event(event: Dictionary) -> void:
	if _waiting and String(event.get("kind", "")) == KIND_LOBBY_ENTERED:
		_finish()

func _finish() -> void:
	_waiting = false
	if _bridge.net_event.is_connected(_on_event):
		_bridge.net_event.disconnect(_on_event)
	entered.emit(net)
