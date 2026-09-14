extends RefCounted
## A SteamApi stand-in for tests: the same signals and methods, an in-memory lobby and inbox, and a record of what the
## game asked Steam for. Lobby creation and joins answer at once, like a Steam client that never waits.

signal lobby_created(ok: bool, lobby_id: int)
signal lobby_joined(ok: bool, lobby_id: int)
signal lobby_member_changed(lobby_id: int, steam_id: int, entered: bool)
signal lobby_list(lobby_ids: Array)
signal join_requested(lobby_id: int)
signal lobby_invite(inviter_id: int, lobby_id: int)
signal session_requested(steam_id: int)

const NEW_LOBBY := 900

var up := true
var steam_id := 100
var name := "SELF"
var members := {}                               # lobby -> Array[int]
var inbox: Array = []                           # [{from, data}]
var sent: Array = []                            # [[to, data]]
var presence := {}                              # key -> value
var joinable := {}                              # lobby -> bool
var left: Array = []
var friend_list: Array = []
var names := {}
var command_line := ""
var lobbies_found: Array = []
var accepted: Array = []
var owned_apps: Array = []

func init() -> bool:
	return up

func available() -> bool:
	return up

func self_id() -> int:
	return steam_id if up else 0

func persona_name() -> String:
	return name

func friend_name(id: int) -> String:
	return names.get(id, "")

func create_lobby(_public: bool) -> void:
	members[NEW_LOBBY] = [steam_id]
	lobby_created.emit(true, NEW_LOBBY)
	lobby_joined.emit(true, NEW_LOBBY)          # Steam reports entering the lobby it created too

func join_lobby(id: int) -> void:
	var list: Array = members.get(id, [])
	list.append(steam_id)
	members[id] = list
	lobby_joined.emit(true, id)

func leave_lobby(id: int) -> void:
	left.append(id)

func set_lobby_joinable(id: int, value: bool) -> void:
	joinable[id] = value

func lobby_members(id: int) -> Array:
	return members.get(id, [])

func request_lobby_list() -> void:
	lobby_list.emit(lobbies_found)

func invite_to_lobby(_id: int, _friend: int) -> bool:
	return up

func open_invite_dialog(_id: int) -> void:
	pass

func send(to: int, data: String) -> bool:
	sent.append([to, data])
	return up

func receive() -> Array:
	var out := inbox
	inbox = []
	return out

func accept_session(id: int) -> void:
	accepted.append(id)

func friends() -> Array:
	return friend_list

func set_rich_presence(key: String, value: String) -> bool:
	presence[key] = value
	return up

func unlock_achievement(_api_name: String) -> bool:
	return up

func cloud_read(_file_name: String):
	return null

func cloud_write(_file_name: String, _data: String) -> bool:
	return up

func cloud_delete(_file_name: String) -> bool:
	return up

func owns_app(app_id: int) -> bool:
	return owned_apps.has(app_id)

func launch_command_line() -> String:
	return command_line
