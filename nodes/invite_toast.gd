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
const BLUR_PASS_SHADER := preload("res://assets/shaders/glass_blur_pass.gdshader")
const SURFACE_SHADER := preload("res://assets/shaders/glass_surface.gdshader")
const WIDTH := 240.0
const RIGHT := 18.0
const BOTTOM := 132.0
const BORDER_PX := 1.0
const PADDING := Vector2(15.0, 13.0)
const GAP := 11.0
const RADIUS := 14.0
const FILL := Color(10.0 / 255.0, 15.0 / 255.0, 20.0 / 255.0, 0.55)
const BORDER := Color(1.0, 1.0, 1.0, 0.12)
const HIGHLIGHT := Color(1.0, 1.0, 1.0, 0.18)        # inset 0 1px 0
const HIGHLIGHT_PX := 1.0
const RING := Color(1.0, 1.0, 1.0, 0.06)             # 0 0 0 0.5px
const RING_PX := 0.5
const SHADOW := Color(0.0, 0.0, 0.0, 0.5)            # 0 8px 40px
const SHADOW_OFFSET := Vector2(0.0, 8.0)
const SHADOW_BLUR := 40.0
const SHADOW_SIGMA_SHARE := 0.5                      # a box-shadow blur is 2σ
const BACKDROP_SIGMA := 24.0                         # backdrop-filter blur(24px): σ 24 px
const SATURATION := 1.6                              # saturate(160%)
const KERNEL_SIGMAS := 3.0
const TITLE_PX := 12.5
const TITLE_SPACING_EM := 0.04
const TITLE_LINE_EM := 1.5
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

var inviter_name := ""
var inviter_id := ""
var lobby_id := ""

var _age := 0.0
var _height := 0.0
var _blur: ColorRect
var _surface: ColorRect
var _title: RichTextLabel
var _accept: UiButton
var _decline: UiButton

func _ready() -> void:
	name = "InviteToast"
	mouse_filter = Control.MOUSE_FILTER_IGNORE          # no backdrop: only the buttons take the mouse
	set_anchors_preset(Control.PRESET_BOTTOM_RIGHT)
	add_child(_screen_copy())                           # what the menu drew so far
	_blur = _shader_rect("BackdropBlur", BLUR_PASS_SHADER)
	add_child(_screen_copy())                           # with the horizontal half of the blur in the box
	_surface = _shader_rect("Surface", SURFACE_SHADER)
	_title = RichTextLabel.new()
	_title.name = "Title"
	_title.bbcode_enabled = false
	_title.scroll_active = false
	_title.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART   # overflow-wrap: break-word
	_title.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_title.add_theme_font_override("normal_font", _title_font(false))
	_title.add_theme_font_override("bold_font", _title_font(true))
	_title.add_theme_font_size_override("normal_font_size", UiFont.css_size(TITLE_PX))
	_title.add_theme_font_size_override("bold_font_size", UiFont.css_size(TITLE_PX))
	_title.add_theme_color_override("default_color", UiTokens.TEXT)
	_title.add_theme_constant_override("line_separation", 0)
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

func _fill_title() -> void:
	_title.clear()
	_title.push_color(UiTokens.ACCENT)
	_title.push_bold()
	_title.add_text(inviter_name)
	_title.pop()
	_title.pop()
	_title.add_text(" " + I18n.t(TITLE_KEY))

func _layout() -> void:
	var left := BORDER_PX + PADDING.x
	var content_width := WIDTH - 2.0 * left
	_title.position = Vector2(left, BORDER_PX + PADDING.y)
	_title.size = Vector2(content_width, 0.0)
	var title_height := float(_title.get_content_height())
	_title.size.y = title_height
	var row_y := _title.position.y + title_height + GAP
	var button_width := (content_width - ROW_GAP) * HALF
	var button_height := _accept.get_combined_minimum_size().y
	for i in 2:
		var button: UiButton = [_accept, _decline][i]
		var x := left + i * (button_width + ROW_GAP)
		button.position = Vector2(CssPixel.snap(x), CssPixel.snap(row_y))
		button.size = Vector2(CssPixel.snap(x + button_width) - button.position.x, button_height)
	_height = row_y + button_height + PADDING.y + BORDER_PX
	var box := Vector2(WIDTH, _height)
	_blur.position = Vector2.ZERO
	_blur.size = box
	(_blur.material as ShaderMaterial).set_shader_parameter("box_px", box)
	var pad := KERNEL_SIGMAS * SHADOW_BLUR * SHADOW_SIGMA_SHARE + SHADOW_OFFSET.length()
	_surface.position = -Vector2.ONE * pad
	_surface.size = box + Vector2.ONE * 2.0 * pad
	var surface := _surface.material as ShaderMaterial
	surface.set_shader_parameter("box_px", box)
	surface.set_shader_parameter("pad_px", pad)
	_place(ENTER_SHIFT * (1.0 - modulate.a) if _age < ENTER_S else 0.0)

func _screen_copy() -> BackBufferCopy:
	var copy := BackBufferCopy.new()
	copy.copy_mode = BackBufferCopy.COPY_MODE_VIEWPORT
	return copy

func _shader_rect(node_name: String, shader: Shader) -> ColorRect:
	var rect := ColorRect.new()
	rect.name = node_name
	rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var material := ShaderMaterial.new()
	material.shader = shader
	material.set_shader_parameter("sigma", BACKDROP_SIGMA)
	if shader == SURFACE_SHADER:
		material.set_shader_parameter("radius_px", RADIUS)
		material.set_shader_parameter("border_px", BORDER_PX)
		material.set_shader_parameter("saturation", SATURATION)
		material.set_shader_parameter("fill_color", FILL)
		material.set_shader_parameter("border_color", BORDER)
		material.set_shader_parameter("highlight_color", HIGHLIGHT)
		material.set_shader_parameter("highlight_px", HIGHLIGHT_PX)
		material.set_shader_parameter("ring_color", RING)
		material.set_shader_parameter("ring_px", RING_PX)
		material.set_shader_parameter("shadow_color", SHADOW)
		material.set_shader_parameter("shadow_offset_px", SHADOW_OFFSET)
		material.set_shader_parameter("shadow_sigma", SHADOW_BLUR * SHADOW_SIGMA_SHARE)
	rect.material = material
	add_child(rect)
	return rect

## 12.5 px spaced 0.04em on a 1.5 line box: Chrome's normal line with the half-leading over and under it; the spacing is
## fitted to Chrome's run width, so the title breaks where web's does.
func _title_font(bold: bool) -> FontVariation:
	var font_size := UiFont.css_size(TITLE_PX)
	var face := UiFont.bold_spaced(0.0, font_size, TITLE_PX) if bold else UiFont.spaced(0.0, font_size, TITLE_PX)
	var embolden := UiFont.embolden_advance(face.variation_embolden, font_size)
	face.spacing_glyph = roundi(UiFont.fitted_spacing(TITLE_PX, TITLE_SPACING_EM, font_size) - embolden)
	UiFont.mirror_fallbacks(face)
	var font := UiFont.with_css_line(face, font_size, TITLE_PX)
	var leading := TITLE_PX * TITLE_LINE_EM - font.get_height(font_size)
	for variation in [font] + font.fallbacks:
		(variation as FontVariation).spacing_top += floori(leading * HALF)
		(variation as FontVariation).spacing_bottom += ceili(leading * HALF)
	return font

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
