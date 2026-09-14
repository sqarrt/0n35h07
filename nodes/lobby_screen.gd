class_name LobbyScreen extends Control
## The "Play" screen — port of web screens/Lobby with components/lobby/MapPicker, TimePicker and Seats, driven by the
## local host RoomModel: a scrolling body (PLAY, the mode carousel, // MAP with MULTI / SELECT ALL and the preview
## tiles, // TIME, // PLAYERS with the seats of the mode) above the full-width READY and BACK / LEAVE. The body
## bleeds 28 px into the panel padding so its thin scrollbar hugs the panel edge. No network yet: no join-by-code row,
## invite zones or search.

signal back_requested
signal match_requested(setup: Dictionary)
signal search_requested                         # desktop Duel SEARCH: Steam quick match
signal stop_requested                           # STOP the search
signal invite_requested                         # a free seat's INVITE A FRIEND: the friend picker
signal map_wished(ids: Array)                   # this side picked maps (web onSetMap also keeps draftSel)
signal duration_wished(minutes: Array)          # this side picked a time (web onSetDuration)

const TITLE_KEY := "menuPlay"                   # web dictionary keys
const BODY_TOP_SHARE := 0.02                    # .lobby-body padding-top: 2vh
const SECTION_GAP := 18.0                       # .lobby-opts padding / gap, .lobby-ogrp gap
const LABEL_FONT_SIZE := 11                     # .lobby-ol
const LABEL_SPACING_EM := 0.18
const LABEL_PREFIX := "// "
const MAP_KEY := "lobbyMap"
const TIME_KEY := "lobbyTime"
const PLAYERS_KEY := "lobbyPlayers"
const MULTI_KEY := "lobbyMulti"
const SELECT_ALL_KEY := "lobbySelectAll"
const MINUTES_KEY := "roomDurationMin"          # "{0} MIN"
const READY_KEY := "lobbyReady"
## The action button's label and look per LobbyState action (web Lobby: one button, the same size in every state).
const ACTIONS := {
	LobbyState.ACTION_STOP: ["lobbyStop", UiButton.STOP],
	LobbyState.ACTION_WAIT_FRIEND: ["lobbyWaitingFriend", UiButton.PRIMARY],
	LobbyState.ACTION_SEARCH: ["lobbySearch", UiButton.PRIMARY],
	LobbyState.ACTION_WAIT_OTHERS: ["lobbyWaitOthers", UiButton.PRIMARY],
	LobbyState.ACTION_READY: ["lobbyReady", UiButton.GO],
}
const LOCKED_OPACITY := 0.5                     # .lobby-opts--locked: map / time are the host's, and frozen while searching
const NAME_CYCLE_S := 0.3                       # web NAME_CYCLE_MS: the searching seats' spinning names
const SPIN_DOTS := 3
const BACK_KEY := "roomBack"
const LEAVE_KEY := "lobbyLeave"
const MAP_COLUMNS := 3
const MAP_GAP := 8.0
const ACTION_GAP := 8.0                         # .lobby-ol-actions gap
const TIME_GAP := 7.0                           # .lobby-segs gap
const SEAT_SHARE := 0.44                        # .lobby-seat / .seats-col flex-basis
const SEATS_GAP := 16.0
const SEATS_MARGIN_BOTTOM := 18.0
const TEAM_COLUMN_PADDING := 6.0                # .seats-col (its team border colour is an invalid 5-digit hex in web)
const TEAM_COLUMN_BORDER := 1.0
const TEAM_SEAT_GAP := 8.0
const FFA_SEAT_SHARE := 0.62
const FFA_GAP := 10.0
const VS_TEXT := "VS"
const VS_FONT_SIZE := 10
const VS_SPACING_EM := 0.2
const VS_COLOR := Color("#3a4655")
const BLEED := 28.0                             # .panel-fill--bleed --bleed
const HALF := 0.5

var room: RoomModel
var desktop := true                             # the Steam build: SEARCH and invite zones (false: the browser layout)
var searching := false                          # quick match is looking for an opponent

var _invites: Array = []                        # sent Steam invites still waiting: [{id, name}]
var _spin := {}                                 # searching: slot -> {name, dots}
var _spin_left := 0.0
var _scroll: ScrollContainer
var _content: Control
var _title: Label
var _carousel: ModeCarousel
var _map_label_row: Control
var _map_label: Label
var _multi: SegButton
var _select_all: SegButton
var _map_tiles: Array[MapTile] = []
var _time_label: Label
var _time_segs: Array[SegButton] = []
var _players_label: Label
var _seats_box: Control
var _seats: Array[LobbySeat] = []
var _vs: Label
var _ready_button: UiButton
var _back: UiButton
var _map_multi := false
var _rng: Callable

## `rng`: 0..1 rolls for rerolled bot names.
func setup(room_model: RoomModel, rng: Callable) -> void:
	_rng = rng
	bind_room(room_model)

## Show another room (the Steam lobby came up, quick match paired): the old one's signals go.
func bind_room(room_model: RoomModel) -> void:
	if room != null:
		room.changed.disconnect(refresh)
		room.started.disconnect(_on_started)
	room = room_model
	room.changed.connect(refresh)
	room.started.connect(_on_started)
	if is_node_ready():
		refresh()

## A sent Steam invite now waits on a free seat (web Lobby onPick).
func add_invite(id: String, friend_name: String) -> void:
	if not _invites.any(func(invite: Dictionary) -> bool: return invite["id"] == id):
		_invites.append({"id": id, "name": friend_name})
	refresh()

## The friend declined or the host cancelled.
func remove_invite(id: String) -> void:
	_invites = _invites.filter(func(invite: Dictionary) -> bool: return invite["id"] != id)
	refresh()

func invites() -> Array:
	return _invites

func set_searching(on: bool) -> void:
	searching = on
	_spin.clear()
	_spin_left = 0.0
	refresh()

func action_kind() -> String:
	return LobbyState.action(room, searching, _invites.size(), desktop)["kind"]

func _on_started(match_setup: Dictionary) -> void:
	match_requested.emit(match_setup)

func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	_scroll = ScrollContainer.new()
	_scroll.name = "Body"
	_scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	UiScroll.style(_scroll.get_v_scroll_bar())
	add_child(_scroll)
	_content = Control.new()
	_content.name = "Content"
	_content.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_scroll.add_child(_content)
	_title = MenuText.title("Title", I18n.t(TITLE_KEY))
	_content.add_child(_title)
	_carousel = ModeCarousel.new()
	_carousel.name = "Modes"
	_content.add_child(_carousel)
	_carousel.mode_picked.connect(_on_mode_picked)
	_map_label_row = Control.new()
	_map_label_row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_content.add_child(_map_label_row)
	_map_label = _label("MapLabel", LABEL_PREFIX + I18n.t(MAP_KEY), LABEL_FONT_SIZE, LABEL_SPACING_EM, UiTokens.MUTED)
	_multi = _seg("Multi", I18n.t(MULTI_KEY))
	_multi.pressed.connect(func() -> void: _set_multi(not _map_multi))
	_select_all = _seg("SelectAll", I18n.t(SELECT_ALL_KEY))
	_select_all.pressed.connect(_on_select_all)
	for id in MapCatalog.MAP_IDS:
		var tile := MapTile.new(id)
		tile.name = "Map_%s" % id
		_content.add_child(tile)
		tile.pressed.connect(_on_map_tile.bind(id))
		_map_tiles.append(tile)
	_time_label = _label("TimeLabel", LABEL_PREFIX + I18n.t(TIME_KEY), LABEL_FONT_SIZE, LABEL_SPACING_EM, UiTokens.MUTED)
	for minutes in MatchConst.MATCH_DURATIONS_MIN:
		var seg := _seg("Time%d" % minutes, I18n.t(MINUTES_KEY, [minutes]))
		seg.pressed.connect(_on_time.bind(minutes))
		_time_segs.append(seg)
	_players_label = _label("PlayersLabel", LABEL_PREFIX + I18n.t(PLAYERS_KEY), LABEL_FONT_SIZE, LABEL_SPACING_EM,
		UiTokens.MUTED)
	_seats_box = Control.new()
	_seats_box.name = "Seats"
	_seats_box.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_content.add_child(_seats_box)
	_vs = _label("Vs", VS_TEXT, VS_FONT_SIZE, VS_SPACING_EM, VS_COLOR)
	_ready_button = UiButton.new(I18n.t(READY_KEY), UiButton.GO)
	_ready_button.name = "Ready"
	_ready_button.pressed.connect(_on_action)
	add_child(_ready_button.grouped())                  # a disabled READY fades as one layer
	_back = UiButton.new(I18n.t(BACK_KEY), UiButton.GHOST)
	_back.name = "Back"
	_back.pressed.connect(func() -> void: back_requested.emit())
	add_child(_back)
	resized.connect(_layout)
	if room != null:
		refresh()

## A guest's handshake clock (HELLO retries, the connect timeout) runs with the screen, and searching seats spin names.
func _process(delta: float) -> void:
	if room is RoomSession:
		(room as RoomSession).tick(delta)
	if not searching:
		return
	_spin_left -= delta
	if _spin_left <= 0.0:
		_spin_left += NAME_CYCLE_S
		_step_spin()

## Re-read the room: the mode, the map / time selection, the seats and the actions.
func refresh() -> void:
	if room == null or _content == null:
		return
	_invites = LobbyState.still_pending(_invites, room)
	var host := room.is_host()
	_carousel.set_mode(room.mode)
	_carousel.set_enabled(host and not searching)
	var locked := searching or not host
	for tile in _map_tiles:
		tile.set_on(tile.map_id in room.map_sel)
	_multi.set_on(_map_multi)
	for i in _time_segs.size():
		_time_segs[i].set_on(MatchConst.MATCH_DURATIONS_MIN[i] in room.duration_sel)
	for option in _locked_options():
		option.modulate.a = LOCKED_OPACITY if locked else 1.0
		if option is BaseButton:
			(option as BaseButton).disabled = locked
	var seat_views := LobbyState.seats(room)
	_rebuild_seats(seat_views)
	var action := LobbyState.action(room, searching, _invites.size(), desktop)
	var look: Array = ACTIONS[action["kind"]]
	_ready_button.text = I18n.t(look[0])
	if _ready_button.variant != look[1]:
		_ready_button.set_variant(look[1])
	_ready_button.set_enabled(action["enabled"])
	_back.text = I18n.t(LEAVE_KEY if LobbyState.others_seated(seat_views) else BACK_KEY)
	_layout()

func _on_action() -> void:
	match action_kind():
		LobbyState.ACTION_STOP:
			stop_requested.emit()
		LobbyState.ACTION_SEARCH:
			search_requested.emit()
		LobbyState.ACTION_READY:
			room.set_local_ready(true)

## web .lobby-opts: the map and time pickers with their labels.
func _locked_options() -> Array:
	var options: Array = [_map_label, _multi, _select_all, _time_label]
	options.append_array(_map_tiles)
	options.append_array(_time_segs)
	return options

## web Seats spin: each free seat shows a model name growing dots, a new name after three.
func _step_spin() -> void:
	for seat in _seats:
		if room.slots[seat.slot] != null:
			continue
		var state: Dictionary = _spin.get(seat.slot, {"name": ModelNames.generate(_rng), "dots": 0})
		seat.show_searching(state["name"] + ".".repeat(state["dots"]))
		state["dots"] += 1
		if state["dots"] > SPIN_DOTS:
			state["dots"] = 0
			state["name"] = ModelNames.generate(_rng)
		_spin[seat.slot] = state
	_layout()

## Parity captures: scroll the body to its top or its end.
func scroll_to_end(to_end: bool) -> void:
	_scroll.scroll_vertical = int(_content.custom_minimum_size.y) if to_end else 0

func seats() -> Array[LobbySeat]:
	return _seats

func _rebuild_seats(seat_views: Array) -> void:
	for seat in _seats:
		_seats_box.remove_child(seat)            # out of the tree now, so the new seats keep their names
		seat.queue_free()
	_seats.clear()
	var compact := room.mode != GameModes.DUEL
	var host := room.is_host()
	var waiting := LobbyState.invite_seats(seat_views, _invites) if desktop and host else {}
	for view in seat_views:
		var slot: int = view["slot"]
		var seat := LobbySeat.new()
		seat.name = "Seat%d" % slot
		seat.slot = slot
		seat.compact = compact
		seat.invites = desktop and host
		_seats_box.add_child(seat)
		if waiting.has(slot):
			seat.show_waiting(waiting[slot]["name"])
		elif searching and view["entry"] == null:
			seat.show_searching("")
		else:
			seat.show_seat(view["entry"], view["mine"], view["ready"], host)
		seat.invite_requested.connect(func(_s: int) -> void: invite_requested.emit())
		seat.invite_cancelled.connect(func(s: int) -> void:
			UiSounds.toggle()
			if waiting.has(s):
				remove_invite(waiting[s]["id"]))
		seat.take_requested.connect(func(s: int) -> void:
			UiSounds.toggle()
			if room is RoomSession:
				(room as RoomSession).request_slot(s))
		seat.add_bot_requested.connect(func(s: int) -> void:
			UiSounds.toggle()
			room.add_bot(s))
		seat.bot_removed.connect(func(s: int) -> void:
			UiSounds.toggle()
			room.remove_bot(s))
		seat.bot_renamed.connect(func(s: int, value: String) -> void: room.set_bot_name(s, value))
		seat.bot_difficulty_picked.connect(func(s: int, difficulty: String) -> void:
			UiSounds.toggle()
			room.set_bot_difficulty(s, difficulty))
		seat.reroll_requested.connect(func(s: int) -> void:
			UiSounds.toggle()
			room.set_bot_name(s, ModelNames.generate(_rng)))
		_seats.append(seat)
	_vs.visible = room.mode != GameModes.WAR

func _layout() -> void:
	if _content == null:
		return
	var width := size.x - BLEED
	var ready_height := _ready_button.get_combined_minimum_size().y   # Chinese labels grow both buttons
	var back_height := _back.get_combined_minimum_size().y
	var body_height := size.y - (ready_height + back_height + 4.0 * UiButton.MARGIN_Y)
	_scroll.position = Vector2.ZERO
	_scroll.size = Vector2(size.x, body_height)
	_ready_button.fade.position = Vector2(0.0, CssPixel.snap(body_height + UiButton.MARGIN_Y))
	_ready_button.fade.size = Vector2(width, ready_height)
	_ready_button.custom_minimum_size.x = width
	_back.position = Vector2(0.0, CssPixel.snap(body_height + ready_height + 3.0 * UiButton.MARGIN_Y))
	_back.custom_minimum_size.x = width
	_back.size = Vector2(width, back_height)
	var column := width
	var bottom := _layout_body(column)
	if bottom > body_height:   # overflow-y: auto — the scrollbar's gutter narrows the column, which lays out again
		column -= UiScroll.WIDTH_PX
		bottom = _layout_body(column)
	_content.custom_minimum_size = Vector2(column, bottom)
	_content.size = _content.custom_minimum_size

## The scrolling body's rows in a column `width` wide; returns the body's height.
func _layout_body(width: float) -> float:
	var y := get_viewport_rect().size.y * BODY_TOP_SHARE
	y = _place(_title, 0.0, y) + MenuText.TITLE_MARGIN_BOTTOM
	_carousel.position = Vector2(0.0, CssPixel.snap(y))
	_carousel.size = Vector2(width, ModeCarousel.HEIGHT)
	y += ModeCarousel.HEIGHT + SECTION_GAP
	y = _layout_maps(y, width) + SECTION_GAP
	y = _place(_time_label, 0.0, y) + SECTION_GAP
	var x := 0.0
	for seg in _time_segs:
		var box := seg.get_combined_minimum_size()
		seg.position = Vector2(CssPixel.snap(x), CssPixel.snap(y))
		seg.size = box
		x += box.x + TIME_GAP
	y += _time_segs[0].get_combined_minimum_size().y + SECTION_GAP
	y = _place(_players_label, 0.0, y) + SECTION_GAP
	return _layout_seats(y, width) + SEATS_MARGIN_BOTTOM

func _layout_maps(top: float, width: float) -> float:
	var label_box := _map_label.get_combined_minimum_size()
	_map_label.position = Vector2(0.0, CssPixel.snap(top))
	_map_label.size = label_box
	var row_centre := top + label_box.y * HALF       # the actions are centred on the label row
	var right := width
	for seg in [_select_all, _multi]:
		var box: Vector2 = seg.get_combined_minimum_size()
		right -= box.x
		seg.position = Vector2(CssPixel.snap(right), CssPixel.snap(row_centre - box.y * HALF))
		seg.size = box
		right -= ACTION_GAP
	var y := top + label_box.y + SECTION_GAP
	var tile_width := (width - MAP_GAP * (MAP_COLUMNS - 1)) / MAP_COLUMNS
	var row_height := 0.0
	for i in _map_tiles.size():
		var tile := _map_tiles[i]
		var column := i % MAP_COLUMNS
		if column == 0 and i > 0:
			y += row_height + MAP_GAP
		tile.size = Vector2(tile_width, tile.custom_minimum_size.y)
		tile.position = Vector2(CssPixel.snap(column * (tile_width + MAP_GAP)), CssPixel.snap(y))
		row_height = tile.custom_minimum_size.y
	return y + row_height

func _layout_seats(top: float, width: float) -> float:
	if _seats.is_empty():
		return top
	_seats_box.position = Vector2(0.0, CssPixel.snap(top))
	var vs_box := _vs.get_combined_minimum_size()
	var height := 0.0
	match room.mode:
		GameModes.WAR:
			var seat_width := width * FFA_SEAT_SHARE
			var y := 0.0
			for seat in _seats:
				var h := seat.get_combined_minimum_size().y
				seat.position = Vector2(CssPixel.snap((width - seat_width) * HALF), CssPixel.snap(y))
				seat.size = Vector2(seat_width, h)
				y += h + FFA_GAP
			height = y - FFA_GAP
		GameModes.BATTLE:
			var column_width := width * SEAT_SHARE
			var inset := TEAM_COLUMN_PADDING + TEAM_COLUMN_BORDER
			var left := (width - 2.0 * column_width - vs_box.x - 2.0 * SEATS_GAP) * HALF
			for team in 2:
				var column_x := left + team * (column_width + vs_box.x + 2.0 * SEATS_GAP)
				var y := inset
				for seat in _seats:
					if GameModes.team_of_slot(room.mode, seat.slot) != team:
						continue
					var h := seat.get_combined_minimum_size().y
					seat.position = Vector2(CssPixel.snap(column_x + inset), CssPixel.snap(y))
					seat.size = Vector2(column_width - 2.0 * inset, h)
					y += h + TEAM_SEAT_GAP
				height = maxf(height, y - TEAM_SEAT_GAP + inset)
			_vs.position = Vector2(CssPixel.snap(left + column_width + SEATS_GAP), CssPixel.snap((height - vs_box.y) * HALF))
		_:
			var seat_width := width * SEAT_SHARE
			var left := (width - 2.0 * seat_width - vs_box.x - 2.0 * SEATS_GAP) * HALF
			for i in _seats.size():
				var seat := _seats[i]
				height = maxf(height, seat.get_combined_minimum_size().y)
				seat.position = Vector2(CssPixel.snap(left + i * (seat_width + vs_box.x + 2.0 * SEATS_GAP)), 0.0)
			for seat in _seats:
				seat.size = Vector2(seat_width, height)
			_vs.position = Vector2(CssPixel.snap(left + seat_width + SEATS_GAP), CssPixel.snap((height - vs_box.y) * HALF))
	_vs.size = vs_box
	if _vs.get_parent() != _seats_box:
		_vs.reparent(_seats_box, false)
	return top + height

func _place(label: Label, x: float, y: float) -> float:
	var box := label.get_combined_minimum_size()
	label.position = Vector2(CssPixel.snap(x), CssPixel.snap(y))
	label.size = box
	return y + box.y

func _label(node_name: String, text: String, font_size: int, spacing_em: float, color: Color, bold := false) -> Label:
	var label := MenuText.label(node_name, text, font_size, spacing_em, color, bold)
	_content.add_child(label)
	return label

func _seg(node_name: String, text: String) -> SegButton:
	var seg := SegButton.new(text)
	seg.name = node_name
	_content.add_child(seg)
	return seg

func _on_mode_picked(mode: String) -> void:
	UiSounds.toggle()
	room.set_mode(mode)

func _on_map_tile(id: String) -> void:
	UiSounds.toggle()
	if not _map_multi:
		_wish_map([id])
		return
	var next := room.map_sel.duplicate()
	if id in next:
		next.erase(id)
	else:
		next.append(id)
	_wish_map(next)

func _set_multi(on: bool) -> void:
	UiSounds.toggle()
	_map_multi = on
	if not on and room.map_sel.size() > 1:
		_wish_map([room.map_sel[0]])
	refresh()

func _on_select_all() -> void:
	UiSounds.toggle()
	_map_multi = true
	_wish_map(MapCatalog.MAP_IDS)

func _on_time(minutes: int) -> void:
	UiSounds.toggle()
	duration_wished.emit([minutes])
	room.set_duration([minutes])

## The room ignores an empty selection (the last map stays), and so does the wish.
func _wish_map(ids: Array) -> void:
	if ids.is_empty():
		return
	map_wished.emit(ids)
	room.set_map(ids)
