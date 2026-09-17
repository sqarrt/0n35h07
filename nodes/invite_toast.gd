class_name InviteToast extends Control
## The Steam invite toast — port of web components/InviteModal (InviteModal.css on the glass.ts glassCard): a non-blocking
## glass card 18 px from the right and 132 px from the bottom, 240 px wide, sliding in from the right: the inviter's name
## (accent, weight 600) before "invites you to a game", then Accept and Decline side by side. A newer invite replaces the
## shown one in place (web keeps the same element, so the entrance does not replay).

signal accepted(lobby_id: String)
signal declined(inviter_id: String)

const TITLE_KEY := "inviteTitle"
const ACCEPT_KEY := "inviteAccept"
const DECLINE_KEY := "inviteDecline"
const WIDTH := 240.0
const RIGHT := 18.0
const BOTTOM := 132.0
const PADDING := Vector2(15.0, 13.0)
const GAP := 11.0
const TITLE_PX := 12.5
const TITLE_SPACING_EM := 0.04
const TITLE_LINE_EM := 1.5
const TITLE_SEPARATOR := " "
const LAYOUT_UNITS := 64.0                           # Chrome LayoutUnit: line boxes floor to 1/64 px
const BUTTON_PX := 11.0
const BUTTON_SPACING_EM := 0.12
const BUTTON_PADDING_Y := 8.0
const BUTTON_RADIUS := 8
const BUTTON_PRESS_PX := 1                           # .invite-btn:active translateY(1px)
const ROW_GAP := 9.0
const ENTER_S := 0.24                                # invite-in .24s cubic-bezier(.2, .8, .2, 1)
const ENTER_CURVE := [0.2, 0.8, 0.2, 1.0]
const ENTER_SHIFT := 22.0
const HALF := 0.5
const ACCEPT_LOOKS := {
	"normal": [Color(68.0 / 255.0, 170.0 / 255.0, 1.0, 0.06), UiTokens.GHOST_LINE, UiTokens.ACCENT_DIM],
	"hover": [Color(68.0 / 255.0, 170.0 / 255.0, 1.0, 0.18), UiTokens.LINE, Color("#eaf5ff")],
	"pressed": [Color(68.0 / 255.0, 170.0 / 255.0, 1.0, 0.18), UiTokens.LINE, Color("#eaf5ff")],
}
const DECLINE_LOOKS := {
	"normal": [Color(1.0, 1.0, 1.0, 0.03), UiTokens.GHOST_LINE, UiTokens.MUTED],
	"hover": [Color(1.0, 102.0 / 255.0, 102.0 / 255.0, 0.16), Color("#b85563"), Color("#ff9999")],
	"pressed": [Color(1.0, 102.0 / 255.0, 102.0 / 255.0, 0.16), Color("#b85563"), Color("#ff9999")],
}

## The title's lines as Chrome draws them: each piece a CSS run (the name bold and accent) at its pen and baseline.
class Title extends Control:
	var pieces: Array = []                      # [CssTextRun, origin, colour]

	func _init() -> void:
		mouse_filter = Control.MOUSE_FILTER_IGNORE

	func _draw() -> void:
		for piece in pieces:
			(piece[0] as CssTextRun).draw(self, piece[1], piece[2])

var inviter_name := ""
var inviter_id := ""
var lobby_id := ""

var _age := 0.0
var _height := 0.0
var _glass: GlassCard
var _title: Title
var _title_lines := PackedStringArray()
var _title_height := 0.0
var _accept: UiButton
var _decline: UiButton

func _ready() -> void:
	name = "InviteToast"
	mouse_filter = Control.MOUSE_FILTER_IGNORE          # no backdrop: only the buttons take the mouse
	set_anchors_preset(Control.PRESET_BOTTOM_RIGHT)
	_glass = GlassCard.new()                            # the glass under everything the card holds
	add_child(_glass)
	_title = Title.new()
	_title.name = "Title"
	add_child(_title)
	_accept = _button("Accept", ACCEPT_KEY, ACCEPT_LOOKS)
	_accept.pressed.connect(func() -> void: accepted.emit(lobby_id))
	_decline = _button("Decline", DECLINE_KEY, DECLINE_LOOKS)
	_decline.pressed.connect(func() -> void: declined.emit(inviter_id))
	_fill_title()
	_layout()
	_enter(0.0)

## Show this invite (the latest wins).
func show_invite(from_name: String, from_id: String, lobby: String) -> void:
	inviter_name = from_name
	inviter_id = from_id
	lobby_id = lobby
	if is_node_ready():
		_fill_title()
		_layout()

func _process(delta: float) -> void:
	_age += delta
	_enter(minf(_age / ENTER_S, 1.0))
	if _age >= ENTER_S:
		set_process(false)

## The entrance at `fraction` of its time: faded in and slid left from ENTER_SHIFT.
func _enter(fraction: float) -> void:
	var eased := CssTiming.cubic_bezier(fraction, ENTER_CURVE)
	modulate.a = eased
	_place(ENTER_SHIFT * (1.0 - eased))

func _place(shift: float) -> void:
	offset_right = -RIGHT + shift
	offset_left = offset_right - WIDTH
	offset_bottom = -BOTTOM
	offset_top = CssPixel.snap(offset_bottom - _height)

## The title's text: the inviter's name, then "invites you to a game".
func title_text() -> String:
	return inviter_name + TITLE_SEPARATOR + I18n.t(TITLE_KEY)

func title_lines() -> PackedStringArray:
	return _title_lines

## Break the title where Chrome would (spaces and CJK, by fractional CSS widths) and lay each line out: the name's part
## bold in the accent, the rest in the text colour, every piece on the line's baseline in a 1.5 line box.
func _fill_title() -> void:
	var text := title_text()
	var content_width := WIDTH - 2.0 * (GlassCard.BORDER_PX + PADDING.x)
	_title_lines = CssLineBreak.lines(text, content_width,
		func(part: String) -> float: return UiFont.css_width(part, TITLE_PX, TITLE_SPACING_EM))
	var line_box := floorf(TITLE_PX * TITLE_LINE_EM * LAYOUT_UNITS) / LAYOUT_UNITS
	var ascent := roundi(UiFont.ASCENT_EM * TITLE_PX)
	var half_leading := floorf((line_box - ascent - roundi(UiFont.DESCENT_EM * TITLE_PX)) * HALF)
	var name_end := inviter_name.length()
	var cursor := 0
	_title.pieces.clear()
	for i in _title_lines.size():
		var line := _title_lines[i]
		var start := text.find(line, cursor)
		cursor = start + line.length()
		var baseline := i * line_box + half_leading + ascent
		var pen := 0.0
		for part in [[start, mini(cursor, name_end), true], [maxi(start, name_end), cursor, false]]:
			if part[1] <= part[0]:
				continue
			var run := CssTextRun.new(text.substr(part[0], part[1] - part[0]), TITLE_PX, TITLE_SPACING_EM, part[2])
			_title.pieces.append([run, Vector2(pen, baseline - run.baseline()), UiTokens.ACCENT if part[2] else UiTokens.TEXT])
			pen += run.width()
	_title_height = line_box * _title_lines.size()
	_title.queue_redraw()

func _layout() -> void:
	var left := GlassCard.BORDER_PX + PADDING.x
	var content_width := WIDTH - 2.0 * left
	_title.position = Vector2(left, GlassCard.BORDER_PX + PADDING.y)
	var title_height := _title_height
	_title.size = Vector2(content_width, title_height)
	var row_y := _title.position.y + title_height + GAP
	var button_width := (content_width - ROW_GAP) * HALF
	var button_height := _accept.get_combined_minimum_size().y
	for i in 2:
		var button: UiButton = [_accept, _decline][i]
		var x := left + i * (button_width + ROW_GAP)
		button.position = Vector2(CssPixel.snap(x), CssPixel.snap(row_y))
		button.size = Vector2(CssPixel.snap(x + button_width) - button.position.x, button_height)
	_height = row_y + button_height + PADDING.y + GlassCard.BORDER_PX
	_glass.set_box(Vector2(WIDTH, _height))
	_place(ENTER_SHIFT * (1.0 - modulate.a) if _age < ENTER_S else 0.0)

func _button(node_name: String, key: String, looks: Dictionary) -> UiButton:
	var metrics := UiButton.Metrics.new()
	metrics.font_px = BUTTON_PX
	metrics.spacing_em = UiFont.control_spacing_em(BUTTON_SPACING_EM)
	metrics.padding = Vector2(0.0, BUTTON_PADDING_Y)
	metrics.min_width = 0.0
	metrics.radius = BUTTON_RADIUS
	metrics.press_shift = BUTTON_PRESS_PX
	metrics.looks = looks
	var button := UiButton.new(I18n.t(key), UiButton.SECONDARY, false, metrics)
	button.name = node_name
	button.focus_mode = Control.FOCUS_NONE
	add_child(button)
	return button
