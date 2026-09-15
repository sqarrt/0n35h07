class_name MainMenu extends Control
## Main menu — port of the web App menu screen (screens/MainMenu in the .menu-panel, components/VersionChip): the
## centred 680 px panel (the page background through 72%, hairline sides), the glowing 0N35H07 logo over the accent
## rule, PLAY (primary), APPEARANCE / SETTINGS / ABOUT (secondary) and, on the desktop build, QUIT (ghost), all half the
## panel wide, and the version chip in the corner (desktop: it opens the log folder). The 3D backdrop, the screens
## behind the buttons and RADIO come with their own slices; the map is picked in the lobby (web). Texts follow the active
## locale (I18n); a language picked in SETTINGS rebuilds the column and that screen. The Play screen's Steam flows are the
## web App's too: a Private Steam lobby hosted on PLAY, SEARCH / STOP quick match, joining a friend (invite toast,
## "Join game", the launch parameter), the friend picker and a guest falling back to hosting when its room closes.

signal screen_requested(screen: String)   # web setScreen: appearance / settings / about

const PANEL_MAX_WIDTH := 680.0             # .menu-panel width: min(680px, 92vw)
const PANEL_VIEWPORT_SHARE := 0.92
const PANEL_BACKGROUND := Color(10.0 / 255.0, 12.0 / 255.0, 17.0 / 255.0, 0.72)
const PANEL_PADDING := Vector2(40.0, 32.0) # padding: 32px 40px
const PANEL_BLUR_PX := 2.0                 # backdrop-filter: blur(2px) — σ in pixels
const BACKDROP_BLUR_SHADER := preload("res://assets/shaders/backdrop_blur.gdshader")
const PANEL_BORDER_PX := 1                 # border-left / -right: 1px var(--surface-line)
const LOGO_TEXT := "0N35H07"
const LOGO_FONT_SIZE := 64                 # 4rem, bold
const LOGO_SPACING_EM := 0.3               # also its margin-left
const LOGO_MARGIN_BOTTOM := 16.0           # 1rem
const LOGO_GLOW_BLUR := 30.0               # text-shadow: 0 0 30px rgba(68,170,255,0.5)
const LOGO_GLOW := Color(68.0 / 255.0, 170.0 / 255.0, 1.0, 0.5)
const RULE_SIZE := Vector2(120.0, 1.0)     # .accent-rule
const RULE_MARGIN_BOTTOM := 32.0           # 2rem
const BUTTON_SHARE := 0.5                  # MENU_BUTTON_WIDTH 50%
const PLAY_KEY := "menuPlay"               # web dictionary keys
const APPEARANCE_KEY := "menuAppearance"
const SETTINGS_KEY := "menuSettings"
const ABOUT_KEY := "settingsSecAbout"
const RADIO_KEY := "settingsVolRadio"         # web borrows the settings volume label, uppercased
const QUIT_KEY := "menuExit"
const SCREEN_RADIO := "radio"
const HINT_KEY := "menuFullscreenHint"     # browser only
const SMALL_FONT_SIZE := 11                # .menu-hint / .version-chip
const SMALL_SPACING_EM := 0.16
const HINT_MARGIN_TOP := 25.6              # 1.6rem
const VERSION_RIGHT := 16.0
const VERSION_BOTTOM := 14.0
const VERSION_HOVER_BRIGHTNESS := 1.7      # .version-chip--btn:hover filter: brightness(1.7)
const CHIP_STATES := ["normal", "hover", "pressed", "hover_pressed", "focus", "disabled"]
const CHIP_BRIGHT_COLORS := ["font_hover_color", "font_pressed_color", "font_hover_pressed_color"]
const SCREEN_APPEARANCE := "appearance"
const SCREEN_SETTINGS := "settings"
const SCREEN_ABOUT := "about"
const SCREEN_TRAILER := "trailer"          # web About onWatchTrailer → setScreen('trailer')
const APPEARANCE_PANEL_MARGIN := 24.0      # web APPEARANCE_PANEL_MARGIN_PX: the panel's gap to the right edge
const PANEL_SLIDE_TAU := MenuCameraRig.DAMP_TAU   # web useDampedTranslateX (MENU_ANIM_TAU)
const PANEL_SLIDE_SNAP := 0.5              # the travel ends within half a pixel
const ARENA := "res://scenes/arena_test.tscn"
const TRAILER_SCENE := "res://scenes/trailer.tscn"
const LOGS_DIR := "user://logs"
const HALF := 0.5
const JOIN_REQUESTED := "joinRequested"   # web steam-net event: "Join game" from the friends list

var _panel: Panel
var _panel_blur: ColorRect
var _column: CssColumn
var _lobby: LobbyScreen
var profile_saving := true                    # parity captures edit an in-memory profile without saving it
var _radio_open := false                      # web screen === 'radio': the takeover instead of the panel
var _screen: Control                          # the open SETTINGS / ABOUT / APPEARANCE screen
var _panel_base_x := 0.0
var _panel_slide := 0.0
var _panel_slide_target := 0.0
var _settings_section := SettingsScreen.SECTION_PLAYER   # web App keeps the settings tab across visits
var _backdrop: MenuBackdrop
var _map_background: MapBackground
var _buttons: Array[UiButton] = []
var _radio: UiButton
var _radio_player: RadioPlayer
var _quit: UiButton
var _hint: Label
var _browser_layout := false
var _version: Button
var steam = null                              # the Steam bridge: SteamBridge, or one over a fake Steam in tests
var _steam_token := 0                         # bumped on every room change: a lobby resolved later is left (web steamEnterToken)
var _steam_lobby: SteamLobby                  # the friend lobby being created or joined
var _late_lobbies: Array[SteamLobby] = []     # superseded lobbies still coming up: left once they arrive
var _quick: SteamQuickMatch
var _forming := false                         # web steamFriendForming
var _draft_maps: Array = [MapCatalog.MAP_IDS[0]]                  # web draftSel: this side's wishes across rooms
var _draft_durations: Array = [RoomModel.DEFAULT_DURATION_MIN]
var _shown_room: RoomModel
var _picker: SteamFriendPicker
var _toast: InviteToast

func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	var background := ColorRect.new()
	background.name = "Background"
	background.color = UiTokens.BG                   # web App root: var(--bg)
	background.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(background)
	background.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_map_background = MapBackground.new()            # web App: the lobby's blurred map behind the spheres
	add_child(_map_background)
	_backdrop = MenuBackdrop.new()                   # web App: the persistent 3D backdrop under the menu panel
	add_child(_backdrop)
	_backdrop.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_panel_blur = _backdrop_blur()
	add_child(_panel_blur)
	_panel = Panel.new()
	_panel.name = "Panel"
	_panel.add_theme_stylebox_override("panel", _panel_box())
	add_child(_panel)
	_build_column()
	_version = _version_chip()
	add_child(_version)
	_add_radio_player()
	resized.connect(_layout)
	_version.minimum_size_changed.connect(_layout)
	_layout()
	if not Game.warning_seen:   # web App: the photosensitivity warning over the menu, once per launch
		var warning := WarningSplash.new()
		warning.dismissed.connect(func() -> void: Game.warning_seen = true)
		add_child(warning)
	Audio.play_menu_music()   # web App: menu music on every non-match screen
	if Game.menu_screen == SCREEN_ABOUT:   # back from the trailer (web onDone → setScreen('about'))
		Game.menu_screen = ""
		open_about()
	_listen_to_steam()
	SteamPresence.apply(SteamBridge, SteamPresence.SCREEN_MENU)   # web App: Rich Presence follows the screen

## PLAY (web handlePlay): the selection back to the first map and time, and a fresh room hosted on every visit — a Private
## Steam lobby friends are invited into, or without Steam a room of our own — shown in the panel instead of the menu.
func open_lobby() -> void:
	close_radio()
	close_screen()
	close_lobby()
	_draft_maps = [MapCatalog.MAP_IDS[0]]
	_draft_durations = [RoomModel.DEFAULT_DURATION_MIN]
	GameLog.log("nego", "play_reset", {"map": _draft_maps, "durationMin": _draft_durations})   # web handlePlay
	_open_lobby_screen()
	_enter_play_idle()
	SteamPresence.apply(SteamBridge, SteamPresence.SCREEN_LOBBY)

## BACK / LEAVE (web handleBack): the room closes, the menu returns.
func close_lobby() -> void:
	_close_picker()
	if _lobby != null:
		_lobby.queue_free()
		_lobby = null
		_leave_room()
		_unwatch_room()
	_map_background.set_shown(false)
	_column.visible = true
	_backdrop.set_screen(MenuCameraRig.SCREEN_MENU)
	_backdrop.set_balls(MenuStage.balls(MenuCameraRig.SCREEN_MENU, MenuStage.profile_spec(Game.profile), [], 0))
	SteamPresence.apply(SteamBridge, SteamPresence.SCREEN_MENU)

## SETTINGS (web setScreen('settings')): the settings screen in the panel, on the tab left open last time; every change
## is saved and the volumes applied at once.
func open_settings() -> void:
	_show_screen(_settings_screen(), MenuCameraRig.SCREEN_SETTINGS)

func _settings_screen() -> SettingsScreen:
	var settings := SettingsScreen.new()
	settings.name = "Settings"
	settings.setup(Game.profile, _settings_section)
	settings.back_requested.connect(close_screen)
	settings.profile_changed.connect(_save_profile)
	settings.section_changed.connect(func(section: String) -> void: _settings_section = section)
	settings.locale_changed.connect(_on_locale_changed)
	return settings

## A language tile (web setLocale: the tree re-renders in place): the menu column and the open settings are built again
## in the new language, on the same tab; the backdrop and its camera stay as they are.
func _on_locale_changed(locale: String) -> void:
	I18n.use_locale(locale)
	_build_column()
	_panel.remove_child(_screen)
	_screen.queue_free()
	_screen = _settings_screen()
	_panel.add_child(_screen)
	_radio_player.relabel()
	_layout()
	get_viewport().update_mouse_cursor_state()   # the new tile under the pointer takes the hover look

## ABOUT (web setScreen('about')): the developer and the trailer; WATCH asks for the trailer screen.
func open_about() -> void:
	var about := AboutScreen.new()
	about.name = "About"
	about.back_requested.connect(close_screen)
	about.trailer_requested.connect(open_trailer)
	_show_screen(about, MenuCameraRig.SCREEN_SETTINGS)

## WATCH (web setScreen('trailer')): the trailer takes the whole window; it returns to ABOUT (web onDone).
func open_trailer() -> void:
	screen_requested.emit(SCREEN_TRAILER)
	Game.menu_screen = SCREEN_ABOUT
	get_tree().change_scene_to_file(TRAILER_SCENE)

## APPEARANCE (web setScreen('appearance')): the cosmetics page; the panel slides right, the backdrop shows the live
## preview from the angle of the last clicked block, the edge glow stays silent.
func open_appearance() -> void:
	var appearance := AppearanceScreen.new()
	appearance.name = "AppearanceScreen"
	appearance.setup(Game.profile)
	appearance.back_requested.connect(close_screen)
	appearance.profile_changed.connect(_save_profile)
	appearance.preview_changed.connect(_show_preview)
	appearance.style_previewed.connect(_backdrop.preview_style)
	_show_screen(appearance, MenuCameraRig.SCREEN_APPEARANCE)

## BACK from SETTINGS / ABOUT / APPEARANCE: the menu returns.
func close_screen() -> void:
	if _screen == null:
		return
	_panel.remove_child(_screen)
	_screen.queue_free()
	_screen = null
	_column.visible = _lobby == null
	_backdrop.glow_muted = false
	_backdrop.set_screen(MenuCameraRig.SCREEN_MENU)
	_backdrop.set_balls(MenuStage.balls(MenuCameraRig.SCREEN_MENU, MenuStage.profile_spec(Game.profile), [], 0))
	_layout()

func screen() -> Control:
	return _screen

## The panel's slide right of its centred place (web translateX), damped toward its target.
func panel_slide() -> float:
	return _panel_slide

## web App: settings and about share the settings camera pose; appearance takes its own and mutes the glow.
func _show_screen(opened: Control, backdrop_screen: String) -> void:
	close_radio()
	close_screen()
	close_lobby()
	_screen = opened
	_backdrop.glow_muted = opened is AppearanceScreen
	_backdrop.set_screen(backdrop_screen)
	_panel.add_child(opened)
	_column.visible = false
	_layout()

## web App menuPlayer on the appearance screen: your ball with the preview's look, the camera on the clicked block.
func _show_preview(spec: Dictionary, part: String) -> void:
	_backdrop.set_screen(MenuCameraRig.SCREEN_APPEARANCE, GameModes.DUEL, false, part)
	_backdrop.set_balls([{"key": MenuStage.PLAYER_KEY, "spec": spec, "spot": MenuStage.STAGE_SPOTS[0]}])

func _save_profile(profile: Dictionary) -> void:
	if profile_saving:
		ProfileStore.save_profile(profile, Game.random.randf)
	Audio.apply_volumes()

func _process(delta: float) -> void:
	_tick_steam(delta)
	if _panel_slide == _panel_slide_target:
		return
	_panel_slide += (_panel_slide_target - _panel_slide) * (1.0 - exp(-minf(delta, MenuCameraRig.MAX_DT) / PANEL_SLIDE_TAU))
	if absf(_panel_slide_target - _panel_slide) < PANEL_SLIDE_SNAP:
		_panel_slide = _panel_slide_target
	_place_panel()

func _place_panel() -> void:
	_panel.position = Vector2(_panel_base_x + _panel_slide, 0.0)
	_panel_blur.position = _panel.position

func backdrop() -> MenuBackdrop:
	return _backdrop

## web App: the lobby backdrop shows the room's seats and frames the preset (Duel pair / Battle-War square).
func _show_room(room: RoomModel) -> void:
	if not room.map_sel.is_empty():
		_map_background.show_map(room.map_sel[0])   # web lastMapId: roomView.mapId ?? draftSel.map[0]
	_backdrop.set_screen(MenuCameraRig.SCREEN_LOBBY, room.mode)
	_backdrop.set_balls(MenuStage.balls(MenuCameraRig.SCREEN_LOBBY, MenuStage.profile_spec(Game.profile), room.occupied(),
		room.local_player_id))

func lobby() -> LobbyScreen:
	return _lobby

# --- the Play screen's rooms (web App enterPlayIdle / bindSession / leaveRoom and the Steam flows) ---

func _open_lobby_screen() -> void:
	_lobby = LobbyScreen.new()
	_lobby.name = "Lobby"
	var draft := _draft_room(true)
	_lobby.setup(draft, Game.random.randf)
	_panel.add_child(_lobby)
	_lobby.back_requested.connect(close_lobby)
	_lobby.match_requested.connect(_start_match)
	_lobby.search_requested.connect(_start_quick_match)
	_lobby.stop_requested.connect(_stop_quick_match)
	_lobby.invite_requested.connect(_open_picker)
	_lobby.map_wished.connect(func(ids: Array) -> void: _draft_maps = ids.duplicate())
	_lobby.duration_wished.connect(func(minutes: Array) -> void: _draft_durations = minutes.duplicate())
	_column.visible = false
	_show_in_lobby(draft)
	_map_background.set_shown(true)
	_layout()

## web enterPlayIdle: the idle Play screen always hosts a room.
func _enter_play_idle() -> void:
	if steam.available():
		_enter_steam_host()
		return
	_leave_room()
	_bind_session(LoopbackNet.new(Game.LOCAL_PEER), RoomSession.ROLE_HOST)

## web enterSteamFriendHost: a Private lobby comes up (me on the host side meanwhile), then a host session on its SteamNet.
func _enter_steam_host() -> void:
	_leave_room()
	_set_forming(true, true)
	_await_lobby(SteamLobby.host(steam), RoomSession.ROLE_HOST)

## web enterSteamFriendClient: a friend's invite, "Join game" or the launch parameter opens the Play screen on the guest
## side while the lobby is joined, then a guest session binds to it.
func _enter_steam_client(lobby_id: String) -> void:
	_leave_room()
	if _lobby == null:
		close_screen()
		_open_lobby_screen()
	_set_forming(true, false)
	_await_lobby(SteamLobby.join(steam, lobby_id), RoomSession.ROLE_CLIENT)

func _await_lobby(lobby: SteamLobby, role: String) -> void:
	if lobby == null:                          # no Steam after all: the draft stays (web: no session)
		_set_forming(false)
		return
	var token := _steam_token
	_steam_lobby = lobby
	lobby.entered.connect(_on_lobby_entered.bind(lobby, token, role))
	if not lobby.is_waiting():                 # Steam answered while the lobby was asked for
		_on_lobby_entered(lobby.net, lobby, token, role)

func _on_lobby_entered(net: SteamNet, lobby: SteamLobby, token: int, role: String) -> void:
	_late_lobbies.erase(lobby)
	if token != _steam_token:
		net.leave()                            # superseded while it came up
		return
	_steam_lobby = null
	_set_forming(false)
	_bind_session(net, role)

## web bindSession: a room session on the transport with this side's selection.
func _bind_session(net, role: String) -> void:
	var room := RoomSession.new(net, role, Game.profile, Game.random.randf, "", _draft_maps, _draft_durations)
	room.closed.connect(_on_room_closed.bind(room))
	Game.room = room
	_show_in_lobby(room)

## web onClosed: a guest whose creator left (or whose handshake timed out) hosts an idle room again.
func _on_room_closed(room: RoomSession) -> void:
	if room != Game.room or _lobby == null:
		return
	_lobby.set_searching(false)
	_enter_play_idle()

## web leaveRoom: the room's transport closes, a lobby still coming up is left once it arrives, the search stops.
func _leave_room() -> void:
	_steam_token += 1
	_set_forming(false)
	if _steam_lobby != null:
		_late_lobbies.append(_steam_lobby)
		_steam_lobby = null
	if _quick != null:
		_quick.stop()
		_quick = null
	Game.leave_room()

func _set_forming(on: bool, hosting := true) -> void:
	_forming = on
	if on:
		_show_in_lobby(_draft_room(hosting))
	if _picker != null:
		_picker.set_forming(on)

func _draft_room(hosting: bool) -> DraftRoom:
	return DraftRoom.new(Game.profile, Game.random.randf, hosting, _draft_maps, _draft_durations)

## The lobby and the backdrop follow this room.
func _show_in_lobby(room: RoomModel) -> void:
	_unwatch_room()
	_shown_room = room
	room.changed.connect(_on_shown_room_changed)
	if _lobby != null:
		_lobby.bind_room(room)
	_show_room(room)

func _unwatch_room() -> void:
	if _shown_room != null and _shown_room.changed.is_connected(_on_shown_room_changed):
		_shown_room.changed.disconnect(_on_shown_room_changed)
	_shown_room = null

func _on_shown_room_changed() -> void:
	_show_room(_shown_room)

## SEARCH (web startSteamQuickMatch): the idle room goes, the seats spin, and the paired lobby's SteamNet becomes the room.
func _start_quick_match() -> void:
	_leave_room()
	_show_in_lobby(_draft_room(true))
	_lobby.set_searching(true)
	var token := _steam_token
	var quick := SteamQuickMatch.new()
	_quick = quick
	quick.matched.connect(_on_quick_matched.bind(token))
	if not quick.start(steam) and token == _steam_token:
		_quick = null
		_lobby.set_searching(false)
		_enter_play_idle()                     # no Steam: a room of our own again

func _on_quick_matched(net: SteamNet, role: String, token: int) -> void:
	if token != _steam_token:
		net.leave()
		return
	_quick = null
	_lobby.set_searching(false)
	_bind_session(net, role)

## STOP (web onLobbyStopSearch): the search ends (its lobby is left) and the idle room is built again.
func _stop_quick_match() -> void:
	_lobby.set_searching(false)
	_enter_play_idle()

func _tick_steam(delta: float) -> void:
	if _steam_lobby != null:
		_steam_lobby.tick(delta)
	for lobby in _late_lobbies.duplicate():
		lobby.tick(delta)
	if _quick != null:
		_quick.tick(delta)

# --- Steam friends (web App invite listeners, Lobby picker and invites) ---

func _listen_to_steam() -> void:
	if steam == null:
		steam = SteamBridge
	steam.net_event.connect(_on_steam_event)
	steam.invite_received.connect(_on_invite_received)
	steam.invite_declined.connect(_on_invite_declined)
	var join_id: String = steam.take_launch_connect()   # web: Steam launched us with "+connect_lobby <id>"
	if join_id == "":
		join_id = steam.take_pending_join()             # a "Join game" that came during a match
	if join_id != "":
		_enter_steam_client(join_id)

func _on_steam_event(event: Dictionary) -> void:
	if String(event.get("kind", "")) == JOIN_REQUESTED:
		steam.take_pending_join()
		_enter_steam_client(String(event["lobbyId"]))

## A free seat's INVITE A FRIEND (web Lobby pickerOpen): the picker over the whole menu, under the invite toast.
func _open_picker() -> void:
	if _picker != null:
		return
	_picker = SteamFriendPicker.new()
	_picker.friends_source = steam.friends
	_picker.forming = _forming
	_picker.picked.connect(_on_friend_picked)
	_picker.closed.connect(_close_picker)
	add_child(_picker)
	if _toast != null:
		move_child(_toast, -1)

## web onPick: the invite goes out and waits on a free seat.
func _on_friend_picked(friend_id: String, friend_name: String) -> void:
	steam.invite_to_lobby(friend_id)
	if _lobby != null:
		_lobby.add_invite(friend_id, friend_name)
	_close_picker()

func _close_picker() -> void:
	if _picker != null:
		_picker.queue_free()
		_picker = null

## web onSteamInviteDeclined: that friend's waiting seat frees.
func _on_invite_declined(decliner_id: String) -> void:
	if _lobby != null:
		_lobby.remove_invite(decliner_id)

## web pendingInvite: an invite received outside a match shows the toast; the newest replaces the shown one.
func _on_invite_received(inviter_name: String, inviter_id: String, lobby_id: String) -> void:
	if _toast != null:
		_toast.show_invite(inviter_name, inviter_id, lobby_id)
		return
	_toast = InviteToast.new()
	_toast.show_invite(inviter_name, inviter_id, lobby_id)
	_toast.accepted.connect(_on_invite_accepted)
	_toast.declined.connect(_on_invite_dismissed)
	add_child(_toast)

func _on_invite_accepted(lobby_id: String) -> void:
	_close_toast()
	_enter_steam_client(lobby_id)

func _on_invite_dismissed(inviter_id: String) -> void:
	steam.decline_invite(inviter_id)
	_close_toast()

func _close_toast() -> void:
	if _toast != null:
		_toast.queue_free()
		_toast = null

## The browser build's layout (parity captures): the F11 hint instead of RADIO and QUIT, no mini-player.
func set_browser_layout(browser: bool) -> void:
	_browser_layout = browser
	_hint.visible = browser
	_radio.visible = not browser
	_quit.visible = not browser
	if _radio_player != null:
		_radio_player.visible = not browser

## The docked mini-player above everything the menu draws (web: rendered last, over the panel and the version chip),
## wired to the Radio autoload, which warms up from here (web: lazily, on a menu screen).
func _add_radio_player() -> void:
	_radio_player = RadioPlayer.new()
	add_child(_radio_player)
	_radio_player.play_pause_requested.connect(_toggle_radio)
	_radio_player.prev_requested.connect(func() -> void: _radio_transport(Radio.prev))
	_radio_player.next_requested.connect(func() -> void: _radio_transport(Radio.next))
	_radio_player.seek_requested.connect(func(fraction: float) -> void:
		_radio_transport(func() -> void: Radio.seek(fraction)))
	_radio_player.volume_changed.connect(_set_radio_volume)
	_radio_player.ball_toggled.connect(_toggle_ball)
	_radio_player.unlock_requested.connect(Radio.open_store)
	_radio_player.back_requested.connect(close_radio)
	_radio_player.open_requested.connect(open_radio)
	_radio_player.visible = not _browser_layout
	Radio.changed.connect(_on_radio_changed)
	Radio.warm_up()
	Radio.set_screen(Radio.SCREEN_MENU)

## web handleToggleRadio: flip the saved switch, then the engine follows.
func _toggle_radio() -> void:
	Game.profile[Radio.KEY_ENABLED] = not Radio.enabled()
	_save_profile(Game.profile)
	Radio.sync()

## web radioPrev / radioNext / radioSeek: a transport action implies playing (ensureRadioOn).
func _radio_transport(action: Callable) -> void:
	if not Radio.enabled():
		Game.profile[Radio.KEY_ENABLED] = true
		_save_profile(Game.profile)
	action.call()
	Radio.sync()

## RADIO (web handleRadio → setScreen('radio')): a full-screen takeover — the menu panel goes, the backdrop takes the
## settings pose with the ball back in view, and the player unfolds centred along the bottom.
func open_radio() -> void:
	close_screen()
	close_lobby()
	_radio_open = true
	_panel.visible = false
	_panel_blur.visible = false
	_set_ball_hidden(false)   # web: re-entering the radio shows the ball again
	_backdrop.set_screen(MenuCameraRig.SCREEN_SETTINGS)
	_radio_player.set_expanded(true)
	screen_requested.emit(SCREEN_RADIO)
	_on_radio_changed()

## BACK from the Radio screen (web onBack → setScreen('menu')): the panel and the docked player return.
func close_radio() -> void:
	if not _radio_open:
		return
	_radio_open = false
	_set_ball_hidden(false)
	_panel.visible = true
	_panel_blur.visible = true
	_radio_player.set_expanded(false)
	_backdrop.set_screen(MenuCameraRig.SCREEN_MENU)
	_backdrop.set_balls(MenuStage.balls(MenuCameraRig.SCREEN_MENU, MenuStage.profile_spec(Game.profile), [], 0))
	_on_radio_changed()

func is_radio_open() -> bool:
	return _radio_open

func radio_player() -> RadioPlayer:
	return _radio_player

## web onVolume: the radio level saved in the profile and sent to the engine.
func _set_radio_volume(value: float) -> void:
	Game.profile[Audio.KEY_RADIO] = value
	_save_profile(Game.profile)
	Radio.apply_volume()

## web onToggleBall: the camera tilts off the ball, or back.
func _toggle_ball() -> void:
	_set_ball_hidden(not _backdrop.rig.hide_ball)

func _set_ball_hidden(hidden: bool) -> void:
	_backdrop.rig.hide_ball = hidden
	_radio_player.show_ball_hidden(hidden)

## The player follows the model and the trial; the menu music gives way while the radio plays (web radioActive).
func _on_radio_changed() -> void:
	_radio_player.show_state(Radio.model.track_label(), Radio.model.is_ready(), Radio.enabled())
	_radio_player.show_details(Radio.model.subtitle(), Radio.model.progress, Radio.model.total_ms)
	_radio_player.show_volume(Audio.radio_volume())
	_radio_player.show_trial(Radio.trial_strip(), Radio.can_unlock(), _radio_open and Radio.gen_limited())
	if RadioDirector.menu_music_allowed(Radio.enabled(), Radio.model.is_ready()):
		Audio.play_menu_music()
	else:
		Audio.stop_menu_music()

func _layout() -> void:
	var width := minf(PANEL_MAX_WIDTH, size.x * PANEL_VIEWPORT_SHARE)
	_panel_base_x = CssPixel.snap((size.x - width) * HALF)
	# web App: on appearance the panel sits APPEARANCE_PANEL_MARGIN from the right edge (Math.round of the offset)
	_panel_slide_target = maxf(0.0, roundf((size.x - width) * HALF - APPEARANCE_PANEL_MARGIN)) \
		if _screen is AppearanceScreen else 0.0
	_panel.size = Vector2(width, size.y)
	_panel_blur.size = _panel.size
	_place_panel()
	(_panel_blur.material as ShaderMaterial).set_shader_parameter("box_px", _panel.size)
	var inset := PANEL_PADDING + Vector2(PANEL_BORDER_PX, 0.0)
	_column.position = inset
	_column.size = _panel.size - inset * 2.0
	if _screen != null:
		_screen.position = inset
		_screen.size = _column.size
	if _lobby != null:
		_lobby.position = inset
		_lobby.size = _column.size + Vector2(LobbyScreen.BLEED, 0.0)
	for button in _buttons:
		button.custom_minimum_size.x = _column.size.x * BUTTON_SHARE
	var chip := _version.get_combined_minimum_size()
	_version.size = chip
	_version.position = size - chip - Vector2(VERSION_RIGHT, VERSION_BOTTOM)

## The .menu-panel backdrop-filter: the 3D backdrop behind the panel blurred before its 72% fill is drawn over it.
func _backdrop_blur() -> ColorRect:
	var blur := ColorRect.new()
	blur.name = "PanelBlur"
	blur.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var composite := ShaderMaterial.new()
	composite.shader = BACKDROP_BLUR_SHADER
	composite.set_shader_parameter("sigma", PANEL_BLUR_PX)
	blur.material = composite
	return blur

func _panel_box() -> StyleBoxFlat:
	var box := StyleBoxFlat.new()
	box.bg_color = PANEL_BACKGROUND
	box.border_color = UiTokens.SURFACE_LINE
	box.border_width_left = PANEL_BORDER_PX
	box.border_width_right = PANEL_BORDER_PX
	box.anti_aliasing = false
	return box

## The logo, the accent rule, the buttons and the hint in the active locale; built again when the language changes.
func _build_column() -> void:
	if _column != null:
		_panel.remove_child(_column)
		_column.queue_free()
	_buttons.clear()
	_column = CssColumn.new()
	_column.name = "Column"
	_column.visible = _screen == null and _lobby == null
	_panel.add_child(_column)
	_panel.move_child(_column, 0)
	_add_logo()
	var rule := ColorRect.new()
	rule.name = "Rule"
	rule.color = UiTokens.LINE
	rule.custom_minimum_size = RULE_SIZE
	rule.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_column.add(rule, 0.0, RULE_MARGIN_BOTTOM)
	_add_button("Play", I18n.t(PLAY_KEY), UiButton.PRIMARY).pressed.connect(_on_play)
	_add_button("Appearance", I18n.t(APPEARANCE_KEY), UiButton.SECONDARY).pressed.connect(open_appearance)
	_add_button("Settings", I18n.t(SETTINGS_KEY), UiButton.SECONDARY).pressed.connect(open_settings)
	_add_button("About", I18n.t(ABOUT_KEY), UiButton.SECONDARY).pressed.connect(open_about)
	_radio = _add_button("Radio", I18n.t(RADIO_KEY).to_upper(), UiButton.SECONDARY)   # web: desktop only
	_radio.pressed.connect(open_radio)
	_quit = _add_button("Quit", I18n.t(QUIT_KEY), UiButton.GHOST)   # web: desktop only — this build always is one
	_quit.pressed.connect(_on_quit)
	_hint = _small_label("Hint", I18n.t(HINT_KEY))
	_column.add(_hint, HINT_MARGIN_TOP)
	set_browser_layout(_browser_layout)

## The h1: bold, spaced 0.3em (margin-left of one spacing), glowing; the run keeps Chrome's trailing spacing.
func _add_logo() -> void:
	var logo := GlowText.new()
	logo.name = "Logo"
	_column.add(logo, 0.0, LOGO_MARGIN_BOTTOM, LOGO_SPACING_EM * LOGO_FONT_SIZE)
	logo.configure_css(LOGO_FONT_SIZE, LOGO_SPACING_EM, UiTokens.ACCENT, true)
	logo.set_text(LOGO_TEXT)
	logo.set_shadows([CssShadow.make(LOGO_GLOW_BLUR, LOGO_GLOW)])

func _add_button(node_name: String, label: String, variant: String) -> UiButton:
	var button := UiButton.new(label, variant)
	button.name = node_name
	_column.add(button, UiButton.MARGIN_Y, UiButton.MARGIN_Y)
	_buttons.append(button)
	return button

func _small_font() -> FontVariation:
	return UiFont.with_css_line(UiFont.spaced(SMALL_SPACING_EM, SMALL_FONT_SIZE), SMALL_FONT_SIZE)

func _small_label(node_name: String, text: String) -> Label:
	return MenuText.label(node_name, text, SMALL_FONT_SIZE, SMALL_SPACING_EM, UiTokens.MUTED)

## The desktop version chip: the plain muted label that opens the log folder, brighter under the mouse.
func _version_chip() -> Button:
	var chip := CssButton.new()
	chip.name = "Version"
	chip.text = "v%s" % Game.GAME_VERSION
	chip.focus_mode = Control.FOCUS_NONE
	chip.add_theme_font_override("font", _small_font())
	chip.add_theme_font_size_override("font_size", SMALL_FONT_SIZE)
	var box := StyleBoxEmpty.new()
	for state in CHIP_STATES:
		chip.add_theme_stylebox_override(state, box)
	chip.set_css_font(SMALL_FONT_SIZE, SMALL_SPACING_EM)
	chip.add_theme_color_override("font_color", UiTokens.MUTED)
	chip.add_theme_color_override("font_focus_color", UiTokens.MUTED)
	var bright := Color(minf(UiTokens.MUTED.r * VERSION_HOVER_BRIGHTNESS, 1.0),
		minf(UiTokens.MUTED.g * VERSION_HOVER_BRIGHTNESS, 1.0), minf(UiTokens.MUTED.b * VERSION_HOVER_BRIGHTNESS, 1.0))
	for key in CHIP_BRIGHT_COLORS:
		chip.add_theme_color_override(key, bright)
	chip.pressed.connect(_on_version)
	return chip

func _on_play() -> void:
	open_lobby()

## The room started: the arena runs on its map, duration and seats (web RoomSession start → App setScreen('game')).
func _start_match(setup: Dictionary) -> void:
	Game.selected_map = MapCatalog.raw_path(setup["map_id"])
	Game.match_duration_ms = setup["duration_min"] * MatchConst.MS_PER_MIN
	Game.lobby_roster = setup["roster"]
	Game.lobby_mode = setup["mode"]
	Game.match_setup = setup                            # the room (Game.room) stays open through the match
	get_tree().change_scene_to_file(ARENA)

func _on_quit() -> void:
	get_tree().quit()

## web logSink.reveal: the session's file in its folder (the folder alone without a session log).
func _on_version() -> void:
	var target: String = Game.log_sink.session_path() if Game.log_sink != null else LOGS_DIR
	OS.shell_show_in_file_manager(ProjectSettings.globalize_path(target))
