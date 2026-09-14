class_name SteamApi extends RefCounted
## The Steamworks calls the game makes, over the GodotSteam singleton — the Godot side of web-reference src-tauri
## steam.rs / steam_net.rs. Every call soft-fails without Steam (no client running, an unowned copy), like the Tauri
## commands. Tests use a fake with the same signals and methods.

signal lobby_created(ok: bool, lobby_id: int)
signal lobby_joined(ok: bool, lobby_id: int)
signal lobby_member_changed(lobby_id: int, steam_id: int, entered: bool)
signal lobby_list(lobby_ids: Array)
signal join_requested(lobby_id: int)
signal lobby_invite(inviter_id: int, lobby_id: int)
signal session_requested(steam_id: int)

const SINGLETON := "Steam"
const APP_ID := 4881310                        # 0N35H07 (dev runs have no Steam launch context: web steam_appid.txt)
const LOBBY_MAX_MEMBERS := 4                   # web LOBBY_MAX_MEMBERS: the mesh holds up to four players
const CHANNEL := 0                             # web NET_CHANNEL
const RECEIVE_BATCH := 32                      # web receive_messages_on_channel(NET_CHANNEL, 32)
const EDITOR_FEATURE := "editor"

var _steam: Object = null
var _available := false

## Start Steam (web init_steam): embedded callbacks, Steam Cloud on, SDR relay access started. Whether it came up.
func init() -> bool:
	if not Engine.has_singleton(SINGLETON):
		return false
	_steam = Engine.get_singleton(SINGLETON)
	var app_id := APP_ID if OS.has_feature(EDITOR_FEATURE) else 0   # a shipped build takes the app from its launch
	var response: Dictionary = _steam.steamInitEx(app_id, true)
	_available = int(response.get("status", -1)) == _constant("STEAM_API_INIT_RESULT_OK")
	if not _available:
		return false
	_steam.setCloudEnabledForApp(true)
	_steam.initRelayNetworkAccess()   # required before NetworkingMessages sessions can come up
	_steam.lobby_created.connect(func(result: int, lobby: int) -> void:
		lobby_created.emit(result == _constant("RESULT_OK"), lobby))
	_steam.lobby_joined.connect(func(lobby: int, _permissions: int, _locked: bool, response_code: int) -> void:
		lobby_joined.emit(response_code == _constant("CHAT_ROOM_ENTER_RESPONSE_SUCCESS"), lobby))
	_steam.lobby_chat_update.connect(func(lobby: int, changed: int, _making_change: int, state: int) -> void:
		lobby_member_changed.emit(lobby, changed, (state & _constant("CHAT_MEMBER_STATE_CHANGE_ENTERED")) != 0))
	_steam.lobby_match_list.connect(func(lobbies: Array) -> void: lobby_list.emit(lobbies))
	_steam.join_requested.connect(func(lobby: int, _friend: int) -> void: join_requested.emit(lobby))
	_steam.lobby_invite.connect(func(inviter: int, lobby: int, _game: int) -> void: lobby_invite.emit(inviter, lobby))
	_steam.network_messages_session_request.connect(func(steam_id: int) -> void: session_requested.emit(steam_id))
	return true

func available() -> bool:
	return _available

func self_id() -> int:
	return _steam.getSteamID() if _available else 0

func persona_name() -> String:
	return _steam.getPersonaName() if _available else ""

func friend_name(steam_id: int) -> String:
	return _steam.getFriendPersonaName(steam_id) if _available else ""

func create_lobby(public: bool) -> void:
	if _available:
		_steam.createLobby(_constant("LOBBY_TYPE_PUBLIC" if public else "LOBBY_TYPE_PRIVATE"), LOBBY_MAX_MEMBERS)

func join_lobby(lobby_id: int) -> void:
	if _available:
		_steam.joinLobby(lobby_id)

func leave_lobby(lobby_id: int) -> void:
	if _available:
		_steam.leaveLobby(lobby_id)

func set_lobby_joinable(lobby_id: int, joinable: bool) -> void:
	if _available:
		_steam.setLobbyJoinable(lobby_id, joinable)

func lobby_members(lobby_id: int) -> Array:
	var members: Array = []
	if _available:
		for i in _steam.getNumLobbyMembers(lobby_id):
			members.append(_steam.getLobbyMemberByIndex(lobby_id, i))
	return members

func request_lobby_list() -> void:
	if _available:
		_steam.requestLobbyList()

func invite_to_lobby(lobby_id: int, friend_id: int) -> bool:
	return _available and _steam.inviteUserToLobby(lobby_id, friend_id)

func open_invite_dialog(lobby_id: int) -> void:
	if _available:
		_steam.activateGameOverlayInviteDialog(lobby_id)

## A reliable message to a peer (web steam_net_send).
func send(to: int, data: String) -> bool:
	return _available and _steam.sendMessageToUser(to, data.to_utf8_buffer(), _constant("NETWORKING_SEND_RELIABLE"),
		CHANNEL) == _constant("RESULT_OK")

## The messages waiting on the game channel: [{from, data}].
func receive() -> Array:
	var out: Array = []
	if not _available:
		return out
	for message in _steam.receiveMessagesOnChannel(CHANNEL, RECEIVE_BATCH):
		out.append({"from": int(message["identity"]), "data": (message["payload"] as PackedByteArray).get_string_from_utf8()})
	return out

func accept_session(steam_id: int) -> void:
	if _available:
		_steam.acceptSessionWithUser(steam_id)

## Immediate friends: [{id, name, online}].
func friends() -> Array:
	var out: Array = []
	if not _available:
		return out
	var flags := _constant("FRIEND_FLAG_IMMEDIATE")
	for i in _steam.getFriendCount(flags):
		var id: int = _steam.getFriendByIndex(i, flags)
		out.append({"id": id, "name": _steam.getFriendPersonaName(id),
			"online": _steam.getFriendPersonaState(id) != _constant("PERSONA_STATE_OFFLINE")})
	return out

## An empty value clears the key.
func set_rich_presence(key: String, value: String) -> bool:
	return _available and _steam.setRichPresence(key, value)

func unlock_achievement(api_name: String) -> bool:
	return _available and _steam.setAchievement(api_name) and _steam.storeStats()

## A Steam Cloud file's text, or null when missing.
func cloud_read(file_name: String):
	if not _available or not _steam.fileExists(file_name):
		return null
	var read: Dictionary = _steam.fileRead(file_name, _steam.getFileSize(file_name))
	return (read.get("buf", PackedByteArray()) as PackedByteArray).get_string_from_utf8()

func cloud_write(file_name: String, data: String) -> bool:
	return _available and _steam.fileWrite(file_name, data.to_utf8_buffer())

func cloud_delete(file_name: String) -> bool:
	return _available and _steam.fileDelete(file_name)

func owns_app(app_id: int) -> bool:
	return _available and _steam.isSubscribedApp(app_id)

func launch_command_line() -> String:
	return _steam.getLaunchCommandLine() if _available else ""

static func _constant(constant_name: String) -> int:
	return ClassDB.class_get_integer_constant(SINGLETON, constant_name)
