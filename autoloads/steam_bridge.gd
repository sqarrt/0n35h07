extends Node
## Steam for the whole game (autoload) — the Godot side of web-reference src-tauri steam_net.rs start_pump and the
## steam.ts bridge: Steam starts once, and every frame the bridge drains the game channel. Steam's lobby callbacks,
## incoming messages and invites become the event stream SteamNet and the lobby controllers read (web "steam-net"
## events: message / peerJoin / peerLeave / lobbyEntered / joinRequested / mmResult), plus received and declined
## invites. Without Steam nothing happens and every query answers "unavailable".

signal net_event(event: Dictionary)
signal invite_received(inviter_name: String, inviter_id: String, lobby_id: String)
signal invite_declined(decliner_id: String)
signal overlay_closed                                   # web "radio-recheck-dlc": the store may have sold the DLC

const DECLINE_MARKER := "__oneshot_invite_declined__"   # web DECLINE_MARKER: never a JSON match message
const RP_CONNECT_KEY := "connect"                       # web RP_CONNECT_KEY: makes a friend "Joinable"
const CONNECT_LOBBY_ARG := "+connect_lobby"             # web: Steam's invite-accept launch parameter
const RADIO_DLC_APP_ID := 4904970                       # web RADIO_DLC_APPID
const STORE_URL := "steam://store/%d"                   # web open_radio_store: the Steam client's own store window

var api = SteamApi.new()                               # a fake stands in for tests (set before the node enters)
var open_url := Callable(OS, "shell_open")              # tests record the URL instead of opening it
var lobby_id := 0                                       # the lobby we are in (0: none)
var pending_join := ""                                  # the last "Join game" nobody took (it came during a match)

var _entered := 0                                       # the lobby lobbyEntered went out for (Steam may report twice)
var _launch_taken := false

func _ready() -> void:
	if not api.init():
		return
	api.lobby_created.connect(_on_lobby_created)
	api.lobby_joined.connect(_on_lobby_joined)
	api.lobby_member_changed.connect(_on_member_changed)
	api.lobby_list.connect(func(ids: Array) -> void:
		net_event.emit({"kind": "mmResult", "lobbies": ids.map(func(id) -> String: return str(id))}))
	api.join_requested.connect(func(id: int) -> void:
		pending_join = str(id)
		net_event.emit({"kind": "joinRequested", "lobbyId": str(id)}))
	api.lobby_invite.connect(func(inviter: int, id: int) -> void:
		invite_received.emit(api.friend_name(inviter), str(inviter), str(id)))
	api.session_requested.connect(func(steam_id: int) -> void: api.accept_session(steam_id))
	api.overlay_toggled.connect(func(active: bool) -> void:
		if not active:
			overlay_closed.emit())

func _process(_delta: float) -> void:
	for message in api.receive():
		var from := str(message["from"])
		if message["data"] == DECLINE_MARKER:
			invite_declined.emit(from)
		else:
			net_event.emit({"kind": "message", "from": from, "data": message["data"]})

func available() -> bool:
	return api.available()

## Our SteamID64 as a string ("" without Steam).
func self_id() -> String:
	return str(api.self_id()) if api.available() else ""

func persona_name() -> String:
	return api.persona_name()

## A Private lobby for friends, or a Public one for quick match; lobbyEntered follows (web steam_net_create_lobby).
func create_lobby(public := false) -> void:
	api.create_lobby(public)

## Join by id (an invite, "Join game", a quick-match pick); lobbyEntered follows.
func join_lobby(id: String) -> void:
	if id.is_valid_int():
		api.join_lobby(int(id))

## Shut the door on a lobby whose match is on: Steam turns a friend's join away at once instead of letting them in to
## a room that cannot seat them (they would sit on a dead connection until it timed out).
func seal_lobby() -> void:
	if lobby_id != 0:
		api.set_lobby_joinable(lobby_id, false)

## Leave the lobby and stop being joinable (web steam_net_leave_lobby).
func leave_lobby() -> void:
	if lobby_id != 0:
		api.leave_lobby(lobby_id)
	lobby_id = 0
	_entered = 0
	api.set_rich_presence(RP_CONNECT_KEY, "")

func members() -> Array:
	return api.lobby_members(lobby_id).map(func(id) -> String: return str(id)) if lobby_id != 0 else []

func send(to: String, data: String) -> bool:
	return to.is_valid_int() and api.send(int(to), data)

## Tell an inviting host we declined, so its waiting seat frees (web steam_decline_invite).
func decline_invite(host_id: String) -> bool:
	return send(host_id, DECLINE_MARKER)

## Search the public quick-match lobbies; mmResult follows.
func search_lobbies() -> void:
	api.request_lobby_list()

func open_invite_dialog() -> void:
	if lobby_id != 0:
		api.open_invite_dialog(lobby_id)

## Immediate friends for the invite picker: online first, then by name (web steam_friends_list).
func friends() -> Array:
	var list: Array = api.friends().map(func(entry: Dictionary) -> Dictionary:
		return {"id": str(entry["id"]), "name": entry["name"], "online": entry["online"]})
	list.sort_custom(func(a: Dictionary, b: Dictionary) -> bool:
		if a["online"] != b["online"]:
			return a["online"]
		return String(a["name"]).to_lower() < String(b["name"]).to_lower())
	return list

func invite_to_lobby(friend_id: String) -> bool:
	return lobby_id != 0 and friend_id.is_valid_int() and api.invite_to_lobby(lobby_id, int(friend_id))

## The lobby a Steam invite launched us into (web steam_take_launch_connect, asked once per launch), or "". The menu
## scene comes back after every match, so only the first ask answers.
func take_launch_connect() -> String:
	if _launch_taken:
		return ""
	_launch_taken = true
	var found := parse_connect_lobby(api.launch_command_line())
	return found if found != "" else parse_connect_lobby(" ".join(OS.get_cmdline_args()))

## The last "Join game" not taken yet (web joins from any screen; here the menu takes it when it is back), or "".
func take_pending_join() -> String:
	var id := pending_join
	pending_join = ""
	return id

func set_rich_presence(key: String, value: String) -> bool:
	return api.set_rich_presence(key, value)

func unlock_achievement(api_name: String) -> bool:
	return api.unlock_achievement(api_name)

func cloud_read(file_name: String):
	return api.cloud_read(file_name)

func cloud_write(file_name: String, data: String) -> bool:
	return api.cloud_write(file_name, data)

func cloud_delete(file_name: String) -> bool:
	return api.cloud_delete(file_name)

func radio_dlc_owned() -> bool:
	return api.owns_app(RADIO_DLC_APP_ID)

## The Radio DLC's store page in the Steam client (web open_radio_store: a steam:// URL, not the in-game overlay,
## which cannot draw over the WebView; the OS hands it to Steam even when the SDK is not up).
func open_radio_store() -> void:
	open_url.call(STORE_URL % RADIO_DLC_APP_ID)

## The lobby id after "+connect_lobby" in a command line (digits only), or "".
static func parse_connect_lobby(command_line: String) -> String:
	var tokens := command_line.split(" ", false)
	var at := tokens.find(CONNECT_LOBBY_ARG)
	if at < 0 or at + 1 >= tokens.size() or not tokens[at + 1].is_valid_int():
		return ""
	return tokens[at + 1]

func _on_lobby_created(ok: bool, id: int) -> void:
	GameLog.log("steam", "lobby_created", {"ok": ok, "lobby": str(id)})   # web: the Rust side's "diag" lines
	if not ok:
		return
	api.set_lobby_joinable(id, true)
	api.set_rich_presence(RP_CONNECT_KEY, str(id))
	_enter(id)

func _on_lobby_joined(ok: bool, id: int) -> void:
	GameLog.log("steam", "lobby_joined", {"ok": ok, "lobby": str(id)})
	if ok:
		_enter(id)

## web lobbyEntered: once per lobby, whether Steam reported the creation, the join, or both.
func _enter(id: int) -> void:
	lobby_id = id
	if _entered == id:
		return
	_entered = id
	net_event.emit({"kind": "lobbyEntered", "lobbyId": str(id), "self": self_id(), "members": members()})

func _on_member_changed(id: int, steam_id: int, entered: bool) -> void:
	GameLog.log("steam", "member_changed", {"lobby": str(id), "member": str(steam_id), "entered": entered})
	if id != lobby_id:
		return
	net_event.emit({"kind": "peerJoin" if entered else "peerLeave", "steamId": str(steam_id)})
