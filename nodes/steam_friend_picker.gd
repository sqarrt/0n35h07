class_name SteamFriendPicker extends Control
## "Choose a friend" — port of web components/lobby/SteamFriendPicker (theme.css .lobby-picker*): over a dim backdrop a
## 360 px card with the title and ✕, a search box, the ONLINE · N count and a fixed-height scrolling list of online
## friends (a green dot, the name and an INVITE chip that fills under the mouse). A note stands in for the list while the
## lobby is still forming or nobody is online. A row invites and closes; Esc, ✕ or the backdrop close. The friends list
## refreshes every 5 s while open.

signal picked(friend_id: String, friend_name: String)
signal closed

const TITLE_KEY := "lobbyPickFriend"
const SEARCH_KEY := "lobbyPickerSearch"
const ONLINE_KEY := "lobbyFriendsOnline"
const FORMING_KEY := "lobbyPreparingLobby"
const EMPTY_KEY := "lobbyNoFriends"
const INVITE_KEY := "lobbyInvite"
const REFRESH_S := 5.0                          # web FRIENDS_REFRESH_MS
const BACKDROP := Color(4.0 / 255.0, 7.0 / 255.0, 11.0 / 255.0, 0.72)   # rgba(4,7,11,.72)
const BACKDROP_PADDING := 16.0
const BACKDROP_BLUR_PX := 2.0                   # backdrop-filter: blur(2px) — σ in pixels
const BACKDROP_BLUR_SHADER := preload("res://assets/shaders/backdrop_blur.gdshader")
const CARD_MAX_WIDTH := 360.0
const CARD_BORDER_PX := 1
const CARD_SHADOW := Color.BLACK                # box-shadow: 0 24px 70px -16px #000
const CARD_SHADOW_OFFSET := Vector2(0.0, 24.0)
const CARD_SHADOW_BLUR := 70.0
const CARD_SHADOW_SPREAD := -16.0
const HEAD_PADDING := [16.0, 16.0, 14.0]       # top, sides, bottom
const TITLE_FONT := 13
const TITLE_SPACING_EM := 0.18
const CLOSE_GLYPH := "✕"
const CLOSE_FONT := 16
const CLOSE_PADDING := Vector2(4.0, 2.0)
const SEARCH_BOTTOM := 14.0
const SIDE_PADDING := 16.0
const INPUT_FONT := 14
const INPUT_SPACING_EM := 0.04
const INPUT_PADDING := Vector2(12.0, 9.0)
const INPUT_BORDER_PX := 1                      # the focus ring is an inset shadow: the box keeps this border
const COUNT_FONT := 11
const COUNT_SPACING_EM := 0.18
const COUNT_BOTTOM := 10.0
const COUNT_SEPARATOR := " · "
const LIST_HEIGHT := 240.0
const LIST_PADDING := 8.0
const NOTE_FONT := 12
const NOTE_SPACING_EM := 0.16
const ROW_MIN_HEIGHT := 44.0
const ROW_PADDING := Vector2(10.0, 8.0)
const ROW_GAP := 12
const ROW_HOVER := Color(40.0 / 255.0, 90.0 / 255.0, 140.0 / 255.0, 0.18)
const DOT_PX := 7.0
const DOT_COLOR := Color("#23b582")
const DOT_GLOW_BLUR := 6.0                      # box-shadow: 0 0 6px -1px #23b582
const DOT_GLOW_SPREAD := -1.0
const NAME_FONT := 14
const NAME_SPACING_EM := 0.04
const CHIP_FONT := 11
const CHIP_SPACING_EM := 0.14
const CHIP_PADDING := Vector2(12.0, 5.0)
const CHIP_BORDER_PX := 1
const HALF := 0.5

## A friend row: the whole row is the button; the chip fills while the row is hovered.
class Row extends Button:
	var chip: PanelContainer
	var chip_label: Label

	func _draw() -> void:
		if is_hovered():
			draw_rect(Rect2(Vector2.ZERO, size), SteamFriendPicker.ROW_HOVER)

	func sync_hover() -> void:
		var hot := is_hovered()
		var box := StyleBoxFlat.new()
		box.bg_color = UiTokens.ACCENT_FILL if hot else Color.TRANSPARENT
		box.border_color = UiTokens.ACCENT_FILL if hot else UiTokens.LINE
		box.set_border_width_all(SteamFriendPicker.CHIP_BORDER_PX)
		var inset := SteamFriendPicker.CHIP_PADDING + Vector2.ONE * SteamFriendPicker.CHIP_BORDER_PX
		box.content_margin_left = inset.x
		box.content_margin_right = inset.x
		box.content_margin_top = inset.y
		box.content_margin_bottom = inset.y
		chip.add_theme_stylebox_override("panel", box)
		chip_label.add_theme_color_override("font_color", UiTokens.INK if hot else UiTokens.ACCENT_DIM)
		queue_redraw()

## A dot with its 6 px green glow (web .lobby-picker-dot).
class Dot extends Control:
	func _ready() -> void:
		var glow := CssBoxShadow.make(SteamFriendPicker.DOT_COLOR, SteamFriendPicker.DOT_GLOW_BLUR, Vector2.ZERO,
			SteamFriendPicker.DOT_GLOW_SPREAD, SteamFriendPicker.DOT_PX * SteamFriendPicker.HALF)
		add_child(glow)
		CssBoxShadow.place(glow, Vector2.ZERO, Vector2.ONE * SteamFriendPicker.DOT_PX)

	func _get_minimum_size() -> Vector2:
		return Vector2.ONE * SteamFriendPicker.DOT_PX

	func _draw() -> void:
		draw_circle(size * SteamFriendPicker.HALF, SteamFriendPicker.DOT_PX * SteamFriendPicker.HALF, SteamFriendPicker.DOT_COLOR)

var friends_source: Callable                    # () -> Array[{id, name, online}] (SteamBridge.friends)
var forming := false                            # the lobby is still being created: a note instead of the list

var _friends: Array = []
var _refresh_left := 0.0
var _blur: ColorRect
var _card_shadow: ColorRect
var _card: PanelContainer
var _search: LineEdit
var _count: Label
var _list: VBoxContainer
var _scroll: ScrollContainer

func _ready() -> void:
	name = "FriendPicker"
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP
	var fresh := BackBufferCopy.new()               # the menu under the picker, not the copy an earlier blur took
	fresh.copy_mode = BackBufferCopy.COPY_MODE_VIEWPORT
	add_child(fresh)
	_blur = ColorRect.new()
	_blur.name = "BackdropBlur"
	_blur.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var blur_material := ShaderMaterial.new()
	blur_material.shader = BACKDROP_BLUR_SHADER
	blur_material.set_shader_parameter("sigma", BACKDROP_BLUR_PX)
	_blur.material = blur_material
	_blur.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(_blur)
	var backdrop := ColorRect.new()
	backdrop.name = "Backdrop"
	backdrop.color = BACKDROP
	backdrop.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	backdrop.gui_input.connect(_on_backdrop_input)
	add_child(backdrop)
	_card_shadow = CssBoxShadow.make(CARD_SHADOW, CARD_SHADOW_BLUR, CARD_SHADOW_OFFSET, CARD_SHADOW_SPREAD)
	_card_shadow.name = "CardShadow"
	add_child(_card_shadow)
	_card = PanelContainer.new()
	_card.name = "Card"
	var card_box := StyleBoxFlat.new()
	card_box.bg_color = UiTokens.BG
	card_box.border_color = UiTokens.SURFACE_LINE
	card_box.set_border_width_all(CARD_BORDER_PX)
	_card.add_theme_stylebox_override("panel", card_box)
	add_child(_card)
	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 0)
	_card.add_child(column)
	column.add_child(_head())
	column.add_child(_padded(_search_box(), SIDE_PADDING, 0.0, SEARCH_BOTTOM))
	_count = MenuText.label("Count", "", COUNT_FONT, COUNT_SPACING_EM, UiTokens.MUTED)
	column.add_child(_padded(_count, SIDE_PADDING, 0.0, COUNT_BOTTOM))
	_scroll = ScrollContainer.new()
	_scroll.name = "List"
	_scroll.custom_minimum_size.y = LIST_HEIGHT - LIST_PADDING
	_scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	UiScroll.style(_scroll.get_v_scroll_bar())
	_list = VBoxContainer.new()
	_list.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_list.add_theme_constant_override("separation", 0)
	_scroll.add_child(_list)
	column.add_child(_padded(_scroll, LIST_PADDING, 0.0, LIST_PADDING))
	resized.connect(_place_card)
	_card.minimum_size_changed.connect(_place_card)
	_refresh()
	_place_card()
	_search.call_deferred("grab_focus")             # web autoFocus

func _process(delta: float) -> void:
	_refresh_left -= delta
	if _refresh_left <= 0.0:
		_refresh()

## Esc closes even while the search box has the focus (web: a window keydown listener).
func _input(event: InputEvent) -> void:
	var key := event as InputEventKey
	if key != null and key.pressed and key.keycode == KEY_ESCAPE:
		get_viewport().set_input_as_handled()
		_close()

## The rows shown: online friends whose name contains the search (web shown).
func shown() -> Array:
	var query := _search.text.strip_edges().to_lower() if _search != null else ""
	return _friends.filter(func(friend: Dictionary) -> bool:
		return friend["online"] and (query == "" or String(friend["name"]).to_lower().contains(query)))

func set_forming(on: bool) -> void:
	forming = on
	_rebuild()

func _refresh() -> void:
	_refresh_left = REFRESH_S
	_friends = friends_source.call() if friends_source.is_valid() else []
	_rebuild()

func _rebuild() -> void:
	if _list == null:
		return
	for child in _list.get_children():
		_list.remove_child(child)
		child.queue_free()
	var online := _friends.filter(func(friend: Dictionary) -> bool: return friend["online"]).size()
	_count.text = I18n.t(ONLINE_KEY) + COUNT_SEPARATOR + str(online)
	var rows := shown()
	if forming or rows.is_empty():
		var note := MenuText.label("Note", I18n.t(FORMING_KEY if forming else EMPTY_KEY), NOTE_FONT, NOTE_SPACING_EM,
			UiTokens.MUTED)
		note.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		note.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
		note.custom_minimum_size.y = LIST_HEIGHT - LIST_PADDING
		note.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		_list.add_child(note)
		return
	for friend in rows:
		_list.add_child(_row(friend))

func _head() -> Control:
	var row := HBoxContainer.new()
	row.name = "Head"
	var title := MenuText.label("Title", I18n.t(TITLE_KEY), TITLE_FONT, TITLE_SPACING_EM, UiTokens.ACCENT_DIM)
	title.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	title.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	row.add_child(title)
	var close_button := GlyphButton.new(CLOSE_GLYPH, CLOSE_FONT, CLOSE_PADDING)
	close_button.name = "Close"
	close_button.size_flags_vertical = Control.SIZE_SHRINK_CENTER   # align-items: center
	close_button.pressed.connect(_close)
	row.add_child(close_button)
	return _padded(row, SIDE_PADDING, HEAD_PADDING[0], HEAD_PADDING[2])

func _search_box() -> LineEdit:
	_search = LineEdit.new()
	_search.name = "Search"
	_search.placeholder_text = I18n.t(SEARCH_KEY)
	var font := UiFont.with_css_line(UiFont.spaced(INPUT_SPACING_EM, INPUT_FONT), INPUT_FONT)
	_search.add_theme_font_override("font", font)
	_search.add_theme_font_size_override("font_size", INPUT_FONT)
	_search.add_theme_color_override("font_color", UiTokens.TEXT)
	_search.add_theme_color_override("font_placeholder_color", UiTokens.MUTED)
	_search.add_theme_stylebox_override("normal", _input_box(UiTokens.LINE, 1))
	_search.add_theme_stylebox_override("focus", _input_box(UiTokens.ACCENT, 2))   # border + 1 px inset ring
	_search.text_changed.connect(func(_text: String) -> void: _rebuild())
	return _search

func _input_box(border: Color, width: int) -> StyleBoxFlat:
	var box := StyleBoxFlat.new()
	box.bg_color = Color.TRANSPARENT
	box.border_color = border
	box.set_border_width_all(width)
	box.content_margin_left = INPUT_PADDING.x + INPUT_BORDER_PX
	box.content_margin_right = INPUT_PADDING.x + INPUT_BORDER_PX
	box.content_margin_top = INPUT_PADDING.y + INPUT_BORDER_PX
	box.content_margin_bottom = INPUT_PADDING.y + INPUT_BORDER_PX
	return box

func _row(friend: Dictionary) -> Row:
	var row := Row.new()
	row.name = "Friend_%s" % friend["id"]
	row.focus_mode = Control.FOCUS_NONE
	row.custom_minimum_size.y = ROW_MIN_HEIGHT
	for state in ["normal", "hover", "pressed", "hover_pressed", "focus"]:
		row.add_theme_stylebox_override(state, StyleBoxEmpty.new())
	var line := HBoxContainer.new()
	line.mouse_filter = Control.MOUSE_FILTER_IGNORE
	line.add_theme_constant_override("separation", ROW_GAP)
	line.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	line.offset_left = ROW_PADDING.x
	line.offset_right = -ROW_PADDING.x
	row.add_child(line)
	var dot := Dot.new()
	dot.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	dot.mouse_filter = Control.MOUSE_FILTER_IGNORE
	line.add_child(dot)
	var friend_name := MenuText.label("Name", friend["name"], NAME_FONT, NAME_SPACING_EM, UiTokens.TEXT)
	friend_name.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	friend_name.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	friend_name.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	friend_name.clip_text = true
	line.add_child(friend_name)
	row.chip = PanelContainer.new()
	row.chip.mouse_filter = Control.MOUSE_FILTER_IGNORE
	row.chip.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	row.chip_label = MenuText.label("Invite", I18n.t(INVITE_KEY), CHIP_FONT, CHIP_SPACING_EM, UiTokens.ACCENT_DIM)
	row.chip.add_child(row.chip_label)
	line.add_child(row.chip)
	row.sync_hover()
	row.mouse_entered.connect(row.sync_hover)
	row.mouse_exited.connect(row.sync_hover)
	row.pressed.connect(func() -> void:
		UiSounds.toggle()
		picked.emit(String(friend["id"]), String(friend["name"])))
	return row

func _padded(node: Control, sides: float, top: float, bottom: float) -> MarginContainer:
	var margin := MarginContainer.new()
	margin.add_theme_constant_override("margin_left", int(sides))
	margin.add_theme_constant_override("margin_right", int(sides))
	margin.add_theme_constant_override("margin_top", int(top))
	margin.add_theme_constant_override("margin_bottom", int(bottom))
	margin.add_child(node)
	return margin

func _place_card() -> void:
	var width := minf(CARD_MAX_WIDTH, size.x - BACKDROP_PADDING * 2.0)
	_card.size = Vector2(width, 0.0)
	_card.reset_size()
	_card.size.x = width
	_card.position = ((size - _card.size) * HALF).round()
	(_blur.material as ShaderMaterial).set_shader_parameter("box_px", size)
	CssBoxShadow.place(_card_shadow, _card.position, _card.size)

func _on_backdrop_input(event: InputEvent) -> void:
	var click := event as InputEventMouseButton
	if click != null and click.pressed and click.button_index == MOUSE_BUTTON_LEFT:
		_close()

func _close() -> void:
	UiSounds.toggle()
	closed.emit()
