class_name LobbyScreen extends Control
## The "Play" screen — port of web screens/Lobby with components/lobby/MapPicker, TimePicker and Seats, driven by the
## local host RoomModel: a scrolling body (PLAY, the mode carousel, // MAP with MULTI / SELECT ALL and the preview
## tiles, // TIME, // PLAYERS with the seats of the mode) above the full-width READY and BACK / LEAVE. The body
## bleeds 28 px into the panel padding so its thin scrollbar hugs the panel edge. No network yet: no join-by-code row,
## invite zones or search.

signal back_requested
signal match_requested(setup: Dictionary)

const TITLE_TEXT := "PLAY"                      # web en menuPlay
const TITLE_FONT_SIZE := 24                     # h2, bold
const TITLE_SPACING_EM := 0.2
const TITLE_MARGIN_BOTTOM := 16.0               # 1rem
const BODY_TOP_SHARE := 0.02                    # .lobby-body padding-top: 2vh
const SECTION_GAP := 18.0                       # .lobby-opts padding / gap, .lobby-ogrp gap
const LABEL_FONT_SIZE := 11                     # .lobby-ol
const LABEL_SPACING_EM := 0.18
const LABEL_PREFIX := "// "
const MAP_TEXT := "MAP"                         # web en lobbyMap
const TIME_TEXT := "TIME"                       # lobbyTime
const PLAYERS_TEXT := "PLAYERS"                 # lobbyPlayers
const MULTI_TEXT := "MULTI"                     # lobbyMulti
const SELECT_ALL_TEXT := "SELECT ALL"           # lobbySelectAll
const MINUTES_FORMAT := "%d MIN"                # roomDurationMin
const READY_TEXT := "READY"                     # lobbyReady
const BACK_TEXT := "BACK"                       # roomBack
const LEAVE_TEXT := "LEAVE"                     # lobbyLeave
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
const SCROLLBAR_PX := 5.0
const SCROLLBAR_RADIUS := 3
const SCROLLBAR_THUMB := Color(47.0 / 255.0, 111.0 / 255.0, 158.0 / 255.0, 0.35)
const HALF := 0.5

var room: RoomModel

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
	room = room_model
	_rng = rng
	room.changed.connect(refresh)
	room.started.connect(func(match_setup: Dictionary) -> void: match_requested.emit(match_setup))
	if is_node_ready():
		refresh()

func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	_scroll = ScrollContainer.new()
	_scroll.name = "Body"
	_scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	_style_scrollbar(_scroll.get_v_scroll_bar())
	add_child(_scroll)
	_content = Control.new()
	_content.name = "Content"
	_content.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_scroll.add_child(_content)
	_title = _label("Title", TITLE_TEXT, TITLE_FONT_SIZE, TITLE_SPACING_EM, UiTokens.ACCENT, true)
	_carousel = ModeCarousel.new()
	_carousel.name = "Modes"
	_content.add_child(_carousel)
	_carousel.mode_picked.connect(_on_mode_picked)
	_map_label_row = Control.new()
	_map_label_row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_content.add_child(_map_label_row)
	_map_label = _label("MapLabel", LABEL_PREFIX + MAP_TEXT, LABEL_FONT_SIZE, LABEL_SPACING_EM, UiTokens.MUTED)
	_multi = _seg("Multi", MULTI_TEXT)
	_multi.pressed.connect(func() -> void: _set_multi(not _map_multi))
	_select_all = _seg("SelectAll", SELECT_ALL_TEXT)
	_select_all.pressed.connect(_on_select_all)
	for id in MapCatalog.MAP_IDS:
		var tile := MapTile.new(id)
		tile.name = "Map_%s" % id
		_content.add_child(tile)
		tile.pressed.connect(_on_map_tile.bind(id))
		_map_tiles.append(tile)
	_time_label = _label("TimeLabel", LABEL_PREFIX + TIME_TEXT, LABEL_FONT_SIZE, LABEL_SPACING_EM, UiTokens.MUTED)
	for minutes in MatchConst.MATCH_DURATIONS_MIN:
		var seg := _seg("Time%d" % minutes, MINUTES_FORMAT % minutes)
		seg.pressed.connect(_on_time.bind(minutes))
		_time_segs.append(seg)
	_players_label = _label("PlayersLabel", LABEL_PREFIX + PLAYERS_TEXT, LABEL_FONT_SIZE, LABEL_SPACING_EM, UiTokens.MUTED)
	_seats_box = Control.new()
	_seats_box.name = "Seats"
	_seats_box.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_content.add_child(_seats_box)
	_vs = _label("Vs", VS_TEXT, VS_FONT_SIZE, VS_SPACING_EM, VS_COLOR)
	_ready_button = UiButton.new(READY_TEXT, UiButton.GO)
	_ready_button.name = "Ready"
	_ready_button.pressed.connect(func() -> void: room.set_local_ready(true))
	add_child(_ready_button.grouped())                  # a disabled READY fades as one layer
	_back = UiButton.new(BACK_TEXT, UiButton.GHOST)
	_back.name = "Back"
	_back.pressed.connect(func() -> void: back_requested.emit())
	add_child(_back)
	resized.connect(_layout)
	if room != null:
		refresh()

## Re-read the room: the mode, the map / time selection, the seats and the actions.
func refresh() -> void:
	if room == null or _content == null:
		return
	_carousel.set_mode(room.mode)
	for tile in _map_tiles:
		tile.set_on(tile.map_id in room.map_sel)
	_multi.set_on(_map_multi)
	for i in _time_segs.size():
		_time_segs[i].set_on(MatchConst.MATCH_DURATIONS_MIN[i] in room.duration_sel)
	_rebuild_seats()
	_ready_button.set_enabled(room.can_start())
	var others_seated := room.occupied().size() > 1
	_back.text = LEAVE_TEXT if others_seated else BACK_TEXT
	_layout()

## Parity captures: scroll the body to its top or its end.
func scroll_to_end(to_end: bool) -> void:
	_scroll.scroll_vertical = int(_content.custom_minimum_size.y) if to_end else 0

func seats() -> Array[LobbySeat]:
	return _seats

func _rebuild_seats() -> void:
	for seat in _seats:
		seat.queue_free()
	_seats.clear()
	var compact := room.mode != GameModes.DUEL
	for slot in room.slots.size():
		var seat := LobbySeat.new()
		seat.name = "Seat%d" % slot
		seat.slot = slot
		seat.compact = compact
		_seats_box.add_child(seat)
		var entry = room.slots[slot]
		seat.show_seat(entry, slot == RoomModel.HOST_SLOT, room.is_ready(slot), true)
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
	var body_height := size.y - 2.0 * (UiButton.BUTTON_HEIGHT + 2.0 * UiButton.MARGIN_Y)
	_scroll.position = Vector2.ZERO
	_scroll.size = Vector2(size.x, body_height)
	_ready_button.fade.position = Vector2(0.0, CssPixel.snap(body_height + UiButton.MARGIN_Y))
	_ready_button.fade.size = Vector2(width, UiButton.BUTTON_HEIGHT)
	_ready_button.custom_minimum_size.x = width
	_back.position = Vector2(0.0, CssPixel.snap(body_height + UiButton.BUTTON_HEIGHT + 3.0 * UiButton.MARGIN_Y))
	_back.custom_minimum_size.x = width
	_back.size = Vector2(width, UiButton.BUTTON_HEIGHT)
	var y := get_viewport_rect().size.y * BODY_TOP_SHARE
	y = _place(_title, 0.0, y) + TITLE_MARGIN_BOTTOM
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
	y = _layout_seats(y, width) + SEATS_MARGIN_BOTTOM
	_content.custom_minimum_size = Vector2(width, y)
	_content.size = _content.custom_minimum_size

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
	var label := Label.new()
	label.name = node_name
	label.text = text
	var face := UiFont.bold_spaced(spacing_em, font_size) if bold else UiFont.spaced(spacing_em, font_size)
	var font := UiFont.with_css_line(face, font_size)
	label.add_theme_font_override("font", font)
	label.add_theme_font_size_override("font_size", font_size)
	label.add_theme_color_override("font_color", color)
	label.add_theme_stylebox_override("normal", UiFont.trailing_spacing_style(font))
	label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_content.add_child(label)
	return label

func _seg(node_name: String, text: String) -> SegButton:
	var seg := SegButton.new(text)
	seg.name = node_name
	_content.add_child(seg)
	return seg

func _style_scrollbar(bar: VScrollBar) -> void:
	var track := StyleBoxEmpty.new()
	track.content_margin_left = SCROLLBAR_PX * HALF
	track.content_margin_right = SCROLLBAR_PX * HALF
	bar.add_theme_stylebox_override("scroll", track)
	bar.add_theme_stylebox_override("scroll_focus", track)
	for state in ["grabber", "grabber_highlight", "grabber_pressed"]:
		var thumb := StyleBoxFlat.new()
		thumb.bg_color = SCROLLBAR_THUMB if state == "grabber" else UiTokens.ACCENT_DIM
		thumb.set_corner_radius_all(SCROLLBAR_RADIUS)
		thumb.content_margin_left = SCROLLBAR_PX * HALF
		thumb.content_margin_right = SCROLLBAR_PX * HALF
		bar.add_theme_stylebox_override(state, thumb)

func _on_mode_picked(mode: String) -> void:
	UiSounds.toggle()
	room.set_mode(mode)

func _on_map_tile(id: String) -> void:
	UiSounds.toggle()
	if not _map_multi:
		room.set_map([id])
		return
	var next := room.map_sel.duplicate()
	if id in next:
		next.erase(id)
	else:
		next.append(id)
	room.set_map(next)                             # the room ignores an empty selection: the last map stays

func _set_multi(on: bool) -> void:
	UiSounds.toggle()
	_map_multi = on
	if not on and room.map_sel.size() > 1:
		room.set_map([room.map_sel[0]])
	refresh()

func _on_select_all() -> void:
	UiSounds.toggle()
	_map_multi = true
	room.set_map(MapCatalog.MAP_IDS)

func _on_time(minutes: int) -> void:
	UiSounds.toggle()
	room.set_duration([minutes])
