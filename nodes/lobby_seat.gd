class_name LobbySeat extends Control
## One lobby seat — port of a web components/lobby/Seats card: a rounded #0a0f17 card with a 2 px dashed border in the
## occupant's colour (solid with a ring and a glow once ready). A free host seat is a stack of dashed action zones filling
## the card — INVITE A FRIEND (desktop) over ADD A BOT; a guest's free seat is TAKE THIS SEAT; the local player's name is
## underlined; the host's bot shows ✕, its editable name and the NORMAL / PASSIVE picker, and a click on the card rerolls
## its name. A sent Steam invite shows the friend with ✕ and a pulsing WAITING tag; while searching a free seat spins
## random names.

signal add_bot_requested(slot: int)
signal bot_removed(slot: int)
signal bot_renamed(slot: int, bot_name: String)
signal bot_difficulty_picked(slot: int, difficulty: String)
signal reroll_requested(slot: int)
signal invite_requested(slot: int)
signal invite_cancelled(slot: int)
signal take_requested(slot: int)

const BORDER_PX := 2.0
const RADIUS := 7
const BACKGROUND := Color("#0a0f17")
const PADDING := Vector2(12.0, 16.0)            # padding: 16px 12px
const COMPACT_PADDING := Vector2(12.0, 10.0)    # 2v2 / FFA cards: 10px 12px
const FREE_PADDING := Vector2(8.0, 8.0)         # .lobby-seat--free: padding 8px
const MIN_HEIGHT := 108.0
const COMPACT_MIN_HEIGHT := 84.0
const GAP := 6.0
const NICK_FONT_SIZE := 16
const NICK_SPACING_EM := 0.06
const UNDERLINE_OFFSET := 5.0                   # text-underline-offset: 5px
const NAME_FIELD_WIDTH := 120.0                 # 7.5rem
const NAME_MAX := 16                            # web settings NAME_MAX
const NAME_PLACEHOLDER_KEY := "lobbyBotNamePlaceholder"   # web dictionary keys
const ZONE_FONT_SIZE := 10
const ZONE_SPACING_EM := 0.16
const ZONE_TEXT := Color("#6f93b3")
const ZONE_HOVER_BACKGROUND := Color(68.0 / 255.0, 170.0 / 255.0, 1.0, 0.06)
const ZONE_BORDER_PX := 1.0
const ADD_BOT_KEY := "lobbyAddBot"
const INVITE_KEY := "lobbyInviteSection"
const TAKE_SEAT_KEY := "lobbyTakeSeat"
const INVITED_KEY := "lobbyInvitedTag"
const PLUS_GLYPH := "＋"                         # .seat-zone-plus
const PLUS_FONT_SIZE := 15
const PLUS_GAP := 7.0                           # .seat-zone gap: 7px
const WAIT_FONT_SIZE := 8                       # .lobby-seat-wait
const WAIT_SPACING_EM := 0.18
const WAIT_DOT_PX := 5.0                        # .lobby-seat-waitdot
const WAIT_DOT_GAP := 5
const PULSE_S := 1.1                            # invitePulse 1.1s ease-in-out infinite
const PULSE_KEYS := [[0.0, 0.35], [0.5, 1.0], [1.0, 0.35]]
const EASE_IN_OUT := [0.42, 0.0, 0.58, 1.0]
const OBLIQUE_SKEW := 0.25                      # .lobby-nick--searching font-style italic: Skia's synthetic oblique
const CANCEL_GLYPH := "✕"
const CANCEL_FONT_SIZE := 13
const CANCEL_INSET := Vector2(8.0, 6.0)         # right: 8px; top: 6px
const CANCEL_PADDING := 2.0
const DIFFICULTY_GAP := 4
const DIFFICULTY_KEYS := {"normal": "roomDiffNormal", "passive": "roomDiffPassive"}
const READY_RING_PX := 1                        # box-shadow: 0 0 0 1px <colour>
const READY_GLOW_BLUR := 20.0                   # box-shadow: 0 0 20px -4px <colour>
const READY_GLOW_SPREAD := -4.0
const GLOW_REACH_SIGMAS := 3.0                  # the glow quad reaches three sigmas past its box
const GLOW_SHADER := preload("res://assets/shaders/glow_rect.gdshader")
const ARC_POINTS := 8
const HALF := 0.5

## A dashed action zone (web .seat-zone): the free card's share, accent under the mouse; `plus` draws the ＋ before it.
class Zone extends Button:
	var plus: Label = null

	func _draw() -> void:
		var color := UiTokens.ACCENT if is_hovered() else UiTokens.LINE
		LobbySeat.draw_dashes(self, Rect2(Vector2.ZERO, size), LobbySeat.ZONE_BORDER_PX, 0.0, color)

	## The ＋ sits PLUS_GAP left of the caption, the pair centred (the caption's left margin makes room for it).
	func place_plus() -> void:
		if plus == null:
			return
		var font := get_theme_font("font")
		var caption := font.get_string_size(text, HORIZONTAL_ALIGNMENT_LEFT, -1, get_theme_font_size("font_size")).x
		var box := plus.get_combined_minimum_size()
		plus.size = box
		plus.position = Vector2((size.x - box.x - LobbySeat.PLUS_GAP - caption) * LobbySeat.HALF, (size.y - box.y) * LobbySeat.HALF)

## The pulsing dot of a waiting seat (web .lobby-seat-waitdot).
class WaitDot extends Control:
	func _get_minimum_size() -> Vector2:
		return Vector2.ONE * LobbySeat.WAIT_DOT_PX

	func _draw() -> void:
		draw_circle(size * LobbySeat.HALF, LobbySeat.WAIT_DOT_PX * LobbySeat.HALF, UiTokens.ACCENT)

var slot := 0
var compact := false
var invites := false                            # a desktop host's free seat also offers INVITE A FRIEND

var _entry = null
var _mine := false
var _is_ready := false
var _host := true
var _waiting := false
var _searching := false
var _pulse_s := 0.0
var _nodes: Array[Control] = []
var _zones: Array[Zone] = []
var _column: CssColumn
var _cancel: Button
var _glow: ColorRect
var _dot: WaitDot
var _spin: Label

## Show the seat: `entry` a roster entry or null (free), whose it is, readiness and whether we host.
func show_seat(entry, mine: bool, ready: bool, host: bool) -> void:
	_clear()
	_entry = entry
	_mine = mine
	_is_ready = ready
	_host = host
	if entry == null:
		if not host:
			_add_zone(_zone("TakeSeat", TAKE_SEAT_KEY, take_requested))
		else:
			if invites:
				_add_zone(_zone("Invite", INVITE_KEY, invite_requested, true))
			_add_zone(_zone("AddBot", ADD_BOT_KEY, add_bot_requested))
	elif entry["kind"] == Roster.KIND_BOT and host:
		_cancel = _cancel_button(bot_removed)
		_add(_cancel)
		_column = _new_column()
		_column.add(_name_field(entry))
		_column.add(_difficulty(entry))
	else:
		_column = _new_column()
		var nick := _nick(entry["name"], Color(entry["color"]))
		nick.underline = mine
		_column.add(nick)
	_finish()

## A sent Steam invite waiting on this free seat: the friend's name, ✕ and the pulsing WAITING tag (web Seats waiting).
func show_waiting(friend_name: String) -> void:
	_clear()
	_host = true
	_waiting = true
	_cancel = _cancel_button(invite_cancelled)
	_add(_cancel)
	_column = _new_column()
	_column.add(_nick(friend_name, UiTokens.MUTED))
	var row := HBoxContainer.new()
	row.name = "Waiting"
	row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	row.add_theme_constant_override("separation", WAIT_DOT_GAP)
	_dot = WaitDot.new()
	_dot.name = "Dot"
	_dot.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	row.add_child(_dot)
	var tag := MenuText.label("Tag", I18n.t(INVITED_KEY), WAIT_FONT_SIZE, WAIT_SPACING_EM, UiTokens.ACCENT)
	row.add_child(tag)
	_column.add(row)
	_pulse_s = 0.0
	_finish()

## A free seat while quick match searches: a spinning random name (web lobby-nick--searching).
func show_searching(text: String) -> void:
	if not _searching:
		_clear()
		_searching = true
		_column = _new_column()
		_spin = _nick(text, UiTokens.MUTED)
		var oblique := _spin.get_theme_font("font").duplicate() as FontVariation
		oblique.variation_transform = Transform2D(Vector2.RIGHT, Vector2(OBLIQUE_SKEW, 1.0), Vector2.ZERO)
		_spin.add_theme_font_override("font", oblique)
		_column.add(_spin)
		_finish()
	_spin.text = text

func glow() -> ColorRect:
	return _ensure_glow()

func zones() -> Array[Zone]:
	return _zones

func is_waiting() -> bool:
	return _waiting

func is_dashed() -> bool:
	return not (_is_ready and _entry != null)

func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_STOP
	resized.connect(_layout)

func _process(delta: float) -> void:
	if _dot == null:
		return
	_pulse_s += delta
	_dot.modulate.a = CssTiming.sample(PULSE_KEYS, fposmod(_pulse_s, PULSE_S) / PULSE_S, EASE_IN_OUT)

func _get_minimum_size() -> Vector2:
	var padding := _padding()
	var content := _column.get_combined_minimum_size().y if _column != null else 0.0
	return Vector2(0.0, maxf(COMPACT_MIN_HEIGHT if compact else MIN_HEIGHT, content + padding.y * 2.0))

func _gui_input(event: InputEvent) -> void:
	var click := event as InputEventMouseButton
	if click != null and click.pressed and click.button_index == MOUSE_BUTTON_LEFT and _is_host_bot():
		reroll_requested.emit(slot)

func _draw() -> void:
	var color := Color(_entry["color"]) if _entry != null else UiTokens.SURFACE_LINE
	var card := StyleBoxFlat.new()
	card.bg_color = BACKGROUND
	card.set_corner_radius_all(RADIUS)
	if not is_dashed():
		card.border_color = color
		card.set_border_width_all(int(BORDER_PX))
	draw_style_box(card, Rect2(Vector2.ZERO, size))
	if is_dashed():
		draw_dashes(self, Rect2(Vector2.ZERO, size), BORDER_PX, float(RADIUS), color)
		return
	var ring := StyleBoxFlat.new()
	ring.draw_center = false
	ring.border_color = color
	ring.set_border_width_all(READY_RING_PX)
	ring.set_expand_margin_all(READY_RING_PX)
	ring.set_corner_radius_all(RADIUS + READY_RING_PX)
	draw_style_box(ring, Rect2(Vector2.ZERO, size))

## Chrome's dashed border inside `rect` (CssDashedBorder): dashes on the four straight runs.
static func draw_dashes(canvas: CanvasItem, rect: Rect2, width: float, radius: float, color: Color) -> void:
	for dash in CssDashedBorder.dashes(rect.size.x, width, radius):
		canvas.draw_rect(Rect2(rect.position.x + dash.x, rect.position.y, dash.y - dash.x, width), color)
		canvas.draw_rect(Rect2(rect.position.x + dash.x, rect.end.y - width, dash.y - dash.x, width), color)
	for dash in CssDashedBorder.dashes(rect.size.y, width, radius):
		canvas.draw_rect(Rect2(rect.position.x, rect.position.y + dash.x, width, dash.y - dash.x), color)
		canvas.draw_rect(Rect2(rect.end.x - width, rect.position.y + dash.x, width, dash.y - dash.x), color)
	if radius <= 0.0:
		return
	# Chrome keeps the rounded corners drawn: a quarter arc along the border's middle line at each corner.
	var arc_radius := radius - width * HALF
	var corners := [
		[Vector2(radius, radius), PI, PI * 1.5],
		[Vector2(rect.size.x - radius, radius), PI * 1.5, TAU],
		[Vector2(rect.size.x - radius, rect.size.y - radius), 0.0, PI * HALF],
		[Vector2(radius, rect.size.y - radius), PI * HALF, PI],
	]
	for corner in corners:
		canvas.draw_arc(rect.position + corner[0], arc_radius, corner[1], corner[2], ARC_POINTS, color, width, true)

func _is_host_bot() -> bool:
	return _host and _entry != null and _entry["kind"] == Roster.KIND_BOT

## .lobby-seat--free (the action zones) packs tighter than an occupied, waiting or searching card.
func _padding() -> Vector2:
	if _entry == null and not _waiting and not _searching:
		return FREE_PADDING
	return COMPACT_PADDING if compact else PADDING

func _layout() -> void:
	var padding := _padding()
	var inner := size - padding * 2.0
	if not _zones.is_empty():
		var height := (inner.y - GAP * (_zones.size() - 1)) / _zones.size()   # .seat-zone flex: 1 1 0
		for i in _zones.size():
			_zones[i].position = padding + Vector2(0.0, i * (height + GAP))
			_zones[i].size = Vector2(inner.x, height)
			_zones[i].place_plus()
	if _column != null:
		_column.position = padding
		_column.size = inner
	if _cancel != null:
		var box := _cancel.get_combined_minimum_size()
		_cancel.size = box
		_cancel.position = Vector2(size.x - CANCEL_INSET.x - box.x, CANCEL_INSET.y)
	_layout_glow()

## The ready glow (box-shadow 0 0 20px -4px): the analytic blurred box, inset by the negative spread, behind the card.
func _layout_glow() -> void:
	if _glow == null or not _glow.visible or _entry == null:
		return
	var sigma := CssShadow.sigma(READY_GLOW_BLUR)
	var pad := sigma * GLOW_REACH_SIGMAS
	var box := size + Vector2.ONE * 2.0 * READY_GLOW_SPREAD
	_glow.position = Vector2.ONE * (-READY_GLOW_SPREAD - pad)
	_glow.size = box + Vector2.ONE * 2.0 * pad
	var material := _glow.material as ShaderMaterial
	material.set_shader_parameter("box_px", box)
	material.set_shader_parameter("pad_px", pad)
	material.set_shader_parameter("sigma", sigma)
	material.set_shader_parameter("glow_color", Color(_entry["color"]))

func _ensure_glow() -> ColorRect:
	if _glow == null:
		_glow = ColorRect.new()
		_glow.name = "Glow"
		_glow.show_behind_parent = true
		_glow.mouse_filter = Control.MOUSE_FILTER_IGNORE
		var material := ShaderMaterial.new()
		material.shader = GLOW_SHADER
		material.set_shader_parameter("core_color", Color.TRANSPARENT)
		_glow.material = material
		_glow.visible = false
		add_child(_glow)
	return _glow

func _clear() -> void:
	for node in _nodes:
		node.queue_free()
	_nodes.clear()
	_zones.clear()
	_column = null
	_cancel = null
	_dot = null
	_spin = null
	_entry = null
	_waiting = false
	_searching = false
	_is_ready = false

func _finish() -> void:
	_ensure_glow().visible = not is_dashed()
	update_minimum_size()
	_layout()
	queue_redraw()

func _add(node: Control) -> void:
	_nodes.append(node)
	add_child(node)

func _add_zone(zone: Zone) -> void:
	_zones.append(zone)
	_add(zone)

func _new_column() -> CssColumn:
	var column := CssColumn.new()
	column.name = "Content"
	column.gap = GAP
	_add(column)
	return column

func _zone(node_name: String, key: String, action: Signal, with_plus := false) -> Zone:
	var zone := Zone.new()
	zone.name = node_name
	zone.text = I18n.t(key)
	zone.focus_mode = Control.FOCUS_NONE
	var font := UiFont.with_css_line(UiFont.spaced(ZONE_SPACING_EM, ZONE_FONT_SIZE), ZONE_FONT_SIZE)
	zone.add_theme_font_override("font", font)
	zone.add_theme_font_size_override("font_size", ZONE_FONT_SIZE)
	var idle := UiFont.trailing_spacing_style(font)
	var hover := StyleBoxFlat.new()
	hover.bg_color = ZONE_HOVER_BACKGROUND
	hover.content_margin_right = font.spacing_glyph
	zone.add_theme_color_override("font_color", ZONE_TEXT)
	for key_name in ["font_hover_color", "font_pressed_color", "font_hover_pressed_color"]:
		zone.add_theme_color_override(key_name, UiTokens.ACCENT)
	if with_plus:
		zone.plus = MenuText.label("Plus", PLUS_GLYPH, PLUS_FONT_SIZE, 0.0, UiTokens.ACCENT)
		zone.add_child(zone.plus)
		var room := zone.plus.get_combined_minimum_size().x + PLUS_GAP   # the caption centres right of the ＋
		idle.content_margin_left = room
		hover.content_margin_left = room
		zone.resized.connect(zone.place_plus)
	for state in ["normal", "pressed", "disabled", "focus"]:
		zone.add_theme_stylebox_override(state, idle)
	for state in ["hover", "hover_pressed"]:
		zone.add_theme_stylebox_override(state, hover)
	zone.mouse_entered.connect(zone.queue_redraw)
	zone.mouse_exited.connect(zone.queue_redraw)
	zone.pressed.connect(func() -> void: action.emit(slot))
	return zone

func _nick_font() -> FontVariation:
	return UiFont.with_css_line(UiFont.spaced(NICK_SPACING_EM, NICK_FONT_SIZE), NICK_FONT_SIZE)

func _nick(text: String, color: Color) -> UnderlinedLabel:
	var nick := UnderlinedLabel.new()
	nick.name = "Nick"
	nick.offset_px = UNDERLINE_OFFSET
	nick.text = text
	var font := _nick_font()
	nick.add_theme_font_override("font", font)
	nick.add_theme_font_size_override("font_size", NICK_FONT_SIZE)
	nick.add_theme_color_override("font_color", color)
	nick.add_theme_stylebox_override("normal", UiFont.trailing_spacing_style(font))
	nick.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return nick

func _name_field(entry: Dictionary) -> LineEdit:
	var field := LineEdit.new()
	field.name = "BotName"
	field.text = entry["name"]
	field.max_length = NAME_MAX
	field.placeholder_text = I18n.t(NAME_PLACEHOLDER_KEY)
	field.alignment = HORIZONTAL_ALIGNMENT_CENTER
	field.custom_minimum_size.x = NAME_FIELD_WIDTH
	var font := _nick_font()
	field.add_theme_font_override("font", font)
	field.add_theme_font_size_override("font_size", NICK_FONT_SIZE)
	field.add_theme_color_override("font_color", Color(entry["color"]))
	field.add_theme_color_override("font_placeholder_color", UiTokens.MUTED)
	for state in ["normal", "focus", "read_only"]:
		field.add_theme_stylebox_override(state, StyleBoxEmpty.new())
	# web .lobby-nick--edit asks for an underline, but Chrome draws no text-decoration inside an <input>
	field.text_changed.connect(func(value: String) -> void: bot_renamed.emit(slot, value))
	return field

func _difficulty(entry: Dictionary) -> HBoxContainer:
	var row := HBoxContainer.new()
	row.name = "Difficulty"
	row.add_theme_constant_override("separation", DIFFICULTY_GAP)
	for difficulty in DIFFICULTY_KEYS:
		var seg := SegButton.new(I18n.t(DIFFICULTY_KEYS[difficulty]), SegButton.SMALL)
		seg.name = String(difficulty).capitalize()
		seg.set_on(entry.get("difficulty", RoomModel.DEFAULT_DIFFICULTY) == difficulty)
		seg.pressed.connect(func() -> void: bot_difficulty_picked.emit(slot, difficulty))
		row.add_child(seg)
	return row

func _cancel_button(action: Signal) -> Button:
	var cancel := Button.new()
	cancel.name = "Remove"
	cancel.text = CANCEL_GLYPH
	cancel.focus_mode = Control.FOCUS_NONE
	cancel.add_theme_font_override("font", UiFont.base())
	cancel.add_theme_font_size_override("font_size", CANCEL_FONT_SIZE)
	var box := StyleBoxEmpty.new()
	box.set_content_margin_all(CANCEL_PADDING)
	for state in ["normal", "hover", "pressed", "hover_pressed", "focus", "disabled"]:
		cancel.add_theme_stylebox_override(state, box)
	cancel.add_theme_color_override("font_color", UiTokens.MUTED)
	for key in ["font_hover_color", "font_pressed_color", "font_hover_pressed_color"]:
		cancel.add_theme_color_override(key, UiTokens.TEXT)
	cancel.pressed.connect(func() -> void: action.emit(slot))
	return cancel
