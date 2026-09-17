class_name SteamQuickMatch extends RefCounted
## Steam quick match — port of web steam/SteamQuickMatch (the desktop SEARCH): search the app's public lobbies; join the
## lowest id, else host a Public lobby and search again every 4 s. A simultaneous create resolves deterministically:
## the lower lobby id is the canonical host, so the higher one leaves its own and joins. The SteamNet that searched
## becomes the match transport once paired. `tick` runs the re-search clock.

signal matched(net: SteamNet, role: String)    # role: RoomSession.ROLE_HOST or ROLE_CLIENT

const RESEARCH_S := 4.0                        # web RESEARCH_MS

var net: SteamNet

var _bridge
var _our_lobby := ""                           # our hosted lobby (once created)
var _done := false
var _research_left := RESEARCH_S

## Begin searching; false without Steam (web start).
func start(bridge) -> bool:
	_bridge = bridge
	net = SteamNetWiring.wire(bridge)
	if net == null:
		return false
	bridge.net_event.connect(_on_event)
	bridge.search_lobbies()
	return true

func is_searching() -> bool:
	return net != null and not _done

func tick(delta: float) -> void:
	if not is_searching():
		return
	_research_left -= delta
	if _research_left <= 0.0:
		_research_left += RESEARCH_S
		_bridge.search_lobbies()

## Cancel the search before a match (web stop): the lobby is left.
func stop() -> void:
	_done = true
	_disconnect()
	if net != null:
		net.leave()
	net = null

func _on_event(event: Dictionary) -> void:
	if _done:
		return
	match String(event.get("kind", "")):
		"mmResult":
			_on_lobbies(event.get("lobbies", []))
		"lobbyEntered":
			_our_lobby = String(event.get("lobbyId", ""))
			for member in event.get("members", []):
				if String(member) != net.self_id:
					_finish(RoomSession.ROLE_HOST)   # someone already sits in our lobby
					return
		"peerJoin":
			_finish(RoomSession.ROLE_HOST)           # a peer joined our hosted lobby

func _on_lobbies(lobbies: Array) -> void:
	var others := lobbies.map(func(id) -> String: return String(id)).filter(func(id: String) -> bool: return id != _our_lobby)
	if others.is_empty():
		if _our_lobby == "":
			_bridge.create_lobby(true)               # nothing to join: host one
		return
	var target: String = others.reduce(func(a: String, b: String) -> String: return a if a < b else b)
	if _our_lobby == "" or target < _our_lobby:
		if _our_lobby != "":
			_bridge.leave_lobby()                    # abandon ours for the canonical one
			_our_lobby = ""
		_finish(RoomSession.ROLE_CLIENT, target)

func _finish(role: String, join_id := "") -> void:
	if _done:
		return
	_done = true
	_disconnect()
	if role == RoomSession.ROLE_CLIENT and join_id != "":
		_bridge.join_lobby(join_id)
	matched.emit(net, role)                          # the room session takes the wired transport

func _disconnect() -> void:
	if _bridge != null and _bridge.net_event.is_connected(_on_event):
		_bridge.net_event.disconnect(_on_event)
