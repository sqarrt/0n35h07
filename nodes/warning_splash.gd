class_name WarningSplash extends Control
## Photosensitivity warning — port of web components/EpilepsyWarning with theme.css `.warn-*`: an opaque screen with a
## faint blue radial glow, the ringed planet breathing behind the centred content — ⚠ WARNING (orange, glowing), the
## warning paragraph (17 px, line-height 1.8, at most 720 px wide) and, after the warm-up, the "[LMB] to continue"
## hint. A left click after the hint fades the screen out (`dismissed`, then it frees itself); earlier clicks are
## ignored. Timing lives in WarningTimeline.

signal dismissed

const BACKDROP_SHADER := preload("res://assets/shaders/warning_backdrop.gdshader")
const TITLE_KEY := "warnTitle"                 # web dictionary keys
const BODY_KEY := "warnBody"
const KEY_KEY := "warnContinueKey"
const HINT_KEY := "warnContinueHint"
const ICON := "⚠"
const BASE := Color("#06080c")                 # .warn-screen background
const GLOW := Color(68.0 / 255.0, 170.0 / 255.0, 1.0, 0.07)   # radial-gradient(1100px 700px at 50% 45%, …, transparent 70%)
const GLOW_RADII := Vector2(1100.0, 700.0)
const GLOW_CENTRE_SHARE := Vector2(0.5, 0.45)
const GLOW_STOP_SHARE := 0.7
## web .warn-planet: the inline SVG (viewBox 256) drawn 560 px wide.
const PLANET_SVG := """<svg xmlns='http://www.w3.org/2000/svg' width='256' height='256' viewBox='0 0 256 256'>
<defs><radialGradient id='warnSphere' cx='37%' cy='31%' r='76%'><stop offset='0%' stop-color='#e8f7ff'/>
<stop offset='28%' stop-color='#73c9ff'/><stop offset='70%' stop-color='#2a8fe0'/><stop offset='100%' stop-color='#093c6f'/>
</radialGradient></defs>
<g transform='rotate(-20 128 128)'><path d='M40 128 A88 29 0 0 1 216 128' fill='none' stroke='#1c66a4' stroke-width='9'
 stroke-linecap='round'/></g>
<circle cx='128' cy='128' r='60' fill='url(#warnSphere)'/>
<ellipse cx='108' cy='104' rx='19' ry='12' fill='#fff' opacity='0.45'/>
<g transform='rotate(-20 128 128)'><path d='M216 128 A88 29 0 0 1 40 128' fill='none' stroke='#a6e3ff' stroke-width='10'
 stroke-linecap='round'/></g>
</svg>"""
const PLANET_VIEWBOX := 256.0
const PLANET_PX := 560.0
const CONTENT_PADDING := 24.0                  # .warn-content padding / gap
const CONTENT_GAP := 34.0
const BOX_GAP := 16.0                          # .warn-box gap / max-width
const BOX_MAX_WIDTH := 720.0
const HEAD_GAP := 12.0                         # .warn-head gap
const TITLE_PX := 19                           # .warn-head: 19px, spaced 0.24em, --opp, text-shadow 0 0 16px
const TITLE_SPACING_EM := 0.24
const TITLE_GLOW := Color(1.0, 170.0 / 255.0, 68.0 / 255.0, 0.4)
const TITLE_GLOW_BLUR := 16.0
const ICON_PX := 26                            # .warn-icon: 26px, the head's 4.56 px spacing inherited
## Chrome draws ⚠ (no glyph in the --ui-font stack) with Windows' Segoe UI Symbol outline triangle (CDP
## getPlatformFontsForNode); Godot's own fallback would pick the colour Segoe UI Emoji.
const ICON_FAMILIES := ["Segoe UI Symbol"]
const ICON_DROP := Color(1.0, 170.0 / 255.0, 68.0 / 255.0, 0.55)
const ICON_DROP_BLUR := 16.0                   # drop-shadow(0 0 8px): σ 8 px, a 16 px CssShadow blur
const BODY_PX := 17                            # .warn-text: 17px, line-height 1.8, spaced 0.04em, --text
const BODY_LINE_HEIGHT := 1.8
const BODY_SPACING_EM := 0.04
const HINT_PX := 14                            # .warn-hint: 14px, spaced 0.16em, --muted, gap 10px
const HINT_SPACING_EM := 0.16
const HINT_GAP := 10.0
const CHIP_PX := 13                            # .warn-chip: 13px, spaced 0.12em, padding 3px 11px, radius 5px
const CHIP_SPACING_EM := 0.12
const CHIP_PADDING := Vector2(11.0, 3.0)
const CHIP_BORDER := 1
const CHIP_RADIUS := 5
const CHIP_FILL := Color(40.0 / 255.0, 90.0 / 255.0, 140.0 / 255.0, 0.18)
const CHIP_DROP := Color(0.0, 0.0, 0.0, 0.4)   # box-shadow 0 1px 0 rgba(0,0,0,.4)
const CHIP_INSET := Color(120.0 / 255.0, 180.0 / 255.0, 1.0, 0.06)   # inset 0 0 0 1px
const CHIP_DROP_OFFSET := Vector2(0.0, 1.0)
const LAYOUT_UNITS := 64.0                     # Chrome LayoutUnit: lengths floor to 1/64 px
const MS_PER_S := 1000.0
const HALF := 0.5
const NO_PIN := -1.0

## The key chip: Chrome's 1 px drop line under the box, the tinted box with its border, the faint inset ring.
class Chip extends Control:
	var _drop := StyleBoxFlat.new()
	var _box := StyleBoxFlat.new()
	var _inset := StyleBoxFlat.new()

	func _init() -> void:
		mouse_filter = Control.MOUSE_FILTER_IGNORE
		_drop.draw_center = false
		_drop.border_width_bottom = WarningSplash.CHIP_BORDER
		_drop.border_color = WarningSplash.CHIP_DROP
		_box.bg_color = WarningSplash.CHIP_FILL
		_box.border_color = UiTokens.LINE
		_box.set_border_width_all(WarningSplash.CHIP_BORDER)
		_inset.draw_center = false
		_inset.border_color = WarningSplash.CHIP_INSET
		_inset.set_border_width_all(WarningSplash.CHIP_BORDER)
		_drop.set_corner_radius_all(WarningSplash.CHIP_RADIUS)
		_box.set_corner_radius_all(WarningSplash.CHIP_RADIUS)
		_inset.set_corner_radius_all(WarningSplash.CHIP_RADIUS - WarningSplash.CHIP_BORDER)

	func _draw() -> void:
		var rect := Rect2(Vector2.ZERO, size)
		draw_style_box(_drop, Rect2(WarningSplash.CHIP_DROP_OFFSET, size))
		draw_style_box(_box, rect)
		draw_style_box(_inset, rect.grow(-WarningSplash.CHIP_BORDER))

## The paragraph: Chrome's line breaks and line boxes, each line drawn on its CSS baseline and centred.
class Paragraph extends Control:
	var lines: Array[TextLine] = []
	var baselines: Array[float] = []

	func _init() -> void:
		mouse_filter = Control.MOUSE_FILTER_IGNORE

	func _draw() -> void:
		for i in lines.size():
			var line := lines[i]
			var x := CssPixel.snap((size.x - line.get_size().x) * WarningSplash.HALF)
			line.draw(get_canvas_item(), Vector2(x, baselines[i] - line.get_line_ascent()), UiTokens.TEXT)

var _elapsed_ms := 0.0
var _out_ms := NO_PIN
var _clock_pinned := false
var _pulse_pin := NO_PIN
var _gone := false
var _backdrop: ColorRect
var _planet: TextureRect
var _content: Control
var _icon: GlowText
var _title: GlowText
var _paragraph: Paragraph
var _body_lines := PackedStringArray()
var _body_width := 0.0
var _hint: Control
var _chip: Chip
var _chip_label: Label
var _hint_label: Label
var _body_font: FontVariation

func _init() -> void:
	name = "WarningSplash"
	mouse_filter = Control.MOUSE_FILTER_STOP
	_backdrop = ColorRect.new()
	_backdrop.name = "Backdrop"
	_backdrop.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var material := ShaderMaterial.new()
	material.shader = BACKDROP_SHADER
	material.set_shader_parameter("radii_px", GLOW_RADII)
	material.set_shader_parameter("stop_share", GLOW_STOP_SHARE)
	material.set_shader_parameter("base_color", BASE)
	material.set_shader_parameter("glow_color", GLOW)
	_backdrop.material = material
	add_child(_backdrop)
	_planet = TextureRect.new()
	_planet.name = "Planet"
	_planet.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_planet.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	var image := Image.new()
	image.load_svg_from_string(PLANET_SVG, PLANET_PX / PLANET_VIEWBOX)
	_planet.texture = ImageTexture.create_from_image(image)
	add_child(_planet)
	_content = Control.new()
	_content.name = "Content"
	_content.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_content)
	var symbol := SystemFont.new()
	symbol.font_names = PackedStringArray(ICON_FAMILIES)
	_icon = _glow_text("Icon", ICON, ICON_PX, TITLE_SPACING_EM * TITLE_PX / ICON_PX,
		[CssShadow.make(TITLE_GLOW_BLUR, TITLE_GLOW), CssShadow.make(ICON_DROP_BLUR, ICON_DROP)], symbol)
	_title = _glow_text("Title", I18n.t(TITLE_KEY), TITLE_PX, TITLE_SPACING_EM, [CssShadow.make(TITLE_GLOW_BLUR, TITLE_GLOW)])
	_body_font = UiFont.with_css_line(UiFont.spaced(BODY_SPACING_EM, BODY_PX), BODY_PX)
	_paragraph = Paragraph.new()
	_paragraph.name = "Body"
	_content.add_child(_paragraph)
	_hint = Control.new()
	_hint.name = "Hint"
	_hint.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_content.add_child(_hint)
	_chip = Chip.new()
	_chip.name = "Chip"
	_hint.add_child(_chip)
	_chip_label = _label("ChipText", I18n.t(KEY_KEY), CHIP_PX, CHIP_SPACING_EM, UiTokens.ACCENT_DIM)
	_chip.add_child(_chip_label)
	_hint_label = _label("HintText", I18n.t(HINT_KEY), HINT_PX, HINT_SPACING_EM, UiTokens.MUTED)
	_hint.add_child(_hint_label)
	_set_body(I18n.t(BODY_KEY))

func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	resized.connect(_layout)
	_layout()
	_apply()

func title_text() -> String:
	return _title.label().text

func body_lines() -> PackedStringArray:
	return _body_lines

## The paragraph box's CSS width: the widest line, at most BOX_MAX_WIDTH.
func body_width() -> float:
	return _body_width

func chip_label() -> Label:
	return _chip_label

func hint_label() -> Label:
	return _hint_label

## Move the splash clock on (the frame clock calls it; tests call it directly).
func advance(ms: float) -> void:
	if _gone:
		return
	_elapsed_ms += ms
	if _out_ms >= 0.0:
		_out_ms += ms
	_apply()

## web handleDismiss: a click once the hint is up starts the fade-out; earlier ones do nothing.
func try_dismiss() -> void:
	if _out_ms >= 0.0 or not WarningTimeline.can_dismiss(_elapsed_ms):
		return
	_out_ms = 0.0
	_apply()

## Parity frames: freeze the clock at `ms` after mount.
func pin_clock_ms(ms: float) -> void:
	_clock_pinned = true
	_elapsed_ms = ms
	_apply()

## Parity frames: hold the planet's breathing at `ms` into its cycle.
func pin_pulse_ms(ms: float) -> void:
	_pulse_pin = ms
	_apply()

func _process(delta: float) -> void:
	if not _clock_pinned:
		advance(delta * MS_PER_S)

func _gui_input(event: InputEvent) -> void:
	var click := event as InputEventMouseButton
	if click != null and click.button_index == MOUSE_BUTTON_LEFT and not click.pressed:
		try_dismiss()

func _apply() -> void:
	_planet.modulate.a = WarningTimeline.planet_opacity(_pulse_pin if _pulse_pin >= 0.0 else _elapsed_ms)
	_content.modulate.a = WarningTimeline.content_opacity(_elapsed_ms)
	_hint.modulate.a = WarningTimeline.hint_opacity(_elapsed_ms)
	mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND if WarningTimeline.can_dismiss(_elapsed_ms) \
		else Control.CURSOR_ARROW
	if _out_ms < 0.0:
		return
	modulate.a = WarningTimeline.screen_opacity(_out_ms)
	if WarningTimeline.is_gone(_out_ms):
		_gone = true
		dismissed.emit()
		queue_free()

func _glow_text(node_name: String, text: String, font_px: int, spacing_em: float, shadows: Array,
		face: Font = null) -> GlowText:
	var glow := GlowText.new()
	glow.name = node_name
	_content.add_child(glow)
	var spaced := UiFont.spaced(spacing_em, font_px, 0.0, face)
	var font := UiFont.with_css_line(spaced, font_px) if face == null else UiFont.with_face_line(spaced, font_px, face)
	var trailing := UiFont.trailing_spacing_style(font)   # Chrome keeps the spacing after the last glyph
	glow.label().add_theme_stylebox_override("normal", trailing)
	glow.mask_label().add_theme_stylebox_override("normal", trailing)
	glow.configure(font, font_px, UiTokens.OPP)
	glow.set_text(text)
	glow.set_shadows(shadows)
	glow.minimum_size_changed.connect(_layout)
	return glow

func _label(node_name: String, text: String, font_px: int, spacing_em: float, color: Color) -> Label:
	var label := MenuText.label(node_name, text, font_px, spacing_em, color)
	label.minimum_size_changed.connect(_layout)
	return label

## Break the paragraph where Chrome would: at spaces and between CJK characters, a line holding what fits in
## BOX_MAX_WIDTH by fractional CSS widths.
func _set_body(text: String) -> void:
	_body_lines = CssLineBreak.lines(text, BOX_MAX_WIDTH, _css_width)
	_body_width = 0.0
	_paragraph.lines.clear()
	for line_text in _body_lines:
		_body_width = maxf(_body_width, _css_width(line_text))
		var line := TextLine.new()
		line.add_string(line_text, _body_font, BODY_PX, UiFont.SYSTEM_FALLBACK_LOCALE)
		_paragraph.lines.append(line)

## A run's CSS width at the body size.
func _css_width(text: String) -> float:
	return UiFont.css_width(text, BODY_PX, BODY_SPACING_EM)

func _layout() -> void:
	if not is_inside_tree():
		return
	_backdrop.size = size
	var material := _backdrop.material as ShaderMaterial
	material.set_shader_parameter("size_px", size)
	material.set_shader_parameter("centre_px", size * GLOW_CENTRE_SHARE)
	_planet.size = Vector2.ONE * PLANET_PX
	_planet.position = (size - _planet.size) * HALF
	_content.size = size
	var icon := _icon.get_combined_minimum_size()
	var title := _title.get_combined_minimum_size()
	var head_height := maxf(icon.y, title.y)
	var line_height := floorf(BODY_PX * BODY_LINE_HEIGHT * LAYOUT_UNITS) / LAYOUT_UNITS
	var body_height := line_height * _body_lines.size()
	var chip_text := _chip_label.get_combined_minimum_size()
	var chip := chip_text + 2.0 * (CHIP_PADDING + Vector2.ONE * CHIP_BORDER)
	var hint_text := _hint_label.get_combined_minimum_size()
	var hint_height := maxf(chip.y, hint_text.y)
	var box_height := head_height + BOX_GAP + body_height
	var top := (size.y - (2.0 * CONTENT_PADDING + box_height + CONTENT_GAP + hint_height)) * HALF + CONTENT_PADDING
	var centre := size.x * HALF
	var head_left := centre - (icon.x + HEAD_GAP + title.x) * HALF
	_place(_icon, Vector2(head_left, top + (head_height - icon.y) * HALF), icon)
	_place(_title, Vector2(head_left + icon.x + HEAD_GAP, top + (head_height - title.y) * HALF), title)
	var body_top := top + head_height + BOX_GAP
	_paragraph.position = Vector2(CssPixel.snap(centre - _body_width * HALF), 0.0)
	_paragraph.size = Vector2(CssPixel.snap(_body_width), size.y)
	var latin_ascent := roundi(UiFont.ASCENT_EM * BODY_PX)
	var latin_line := latin_ascent + roundi(UiFont.DESCENT_EM * BODY_PX)
	var half_leading := floorf((line_height - latin_line) * HALF)
	_paragraph.baselines.clear()
	for i in _body_lines.size():
		_paragraph.baselines.append(CssPixel.snap(body_top + i * line_height + half_leading + latin_ascent))
	_paragraph.queue_redraw()
	var hint_top := body_top + body_height + CONTENT_GAP
	var hint_left := centre - (chip.x + HINT_GAP + hint_text.x) * HALF
	_hint.position = Vector2.ZERO
	_hint.size = size
	_place(_chip, Vector2(hint_left, hint_top + (hint_height - chip.y) * HALF), chip)
	_chip_label.position = CHIP_PADDING + Vector2.ONE * CHIP_BORDER
	_chip_label.size = chip_text
	_place(_hint_label, Vector2(hint_left + chip.x + HINT_GAP, hint_top + (hint_height - hint_text.y) * HALF), hint_text)
	_chip.queue_redraw()

func _place(control: Control, position_px: Vector2, box: Vector2) -> void:
	control.position = Vector2(CssPixel.snap(position_px.x), CssPixel.snap(position_px.y))
	control.size = box
