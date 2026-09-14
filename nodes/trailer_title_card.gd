class_name TrailerTitleCard extends Control
## The trailer's closing title — port of theme.css .trailer-title-wrap: 0N35H07 in huge glowing accent capitals, the
## tagline, and the Steam call to action in a glowing outline, centred as a flex column 1.1rem apart and surfacing one
## after another (trailer-fade: up 8 px from transparent over 0.6 s ease-out, 0 / 0.35 / 0.8 s in). Sizes are the
## clamp() values at the 1280 px window.

const GLOW_SHADER := preload("res://assets/shaders/css_outer_glow.gdshader")
const TITLE := "0N35H07"
const TAGLINE := "ONE SHOT. ONE KILL. 1v1"
const CTA := "WISHLIST NOW ON STEAM"
const TITLE_PX := 128.0                        # clamp(3rem, 11vw, 8rem)
const TITLE_SPACING_EM := 0.18
const TITLE_GLOW_BLUR := 40.0                  # text-shadow 0 0 40px rgba(68,170,255,.6)
const TITLE_GLOW := Color(68.0 / 255.0, 170.0 / 255.0, 1.0, 0.6)
const TAGLINE_PX := 17.6                       # clamp(.7rem, 1.8vw, 1.1rem)
const TAGLINE_SPACING_EM := 0.3
const CTA_PX := 22.4                           # clamp(.9rem, 2.2vw, 1.4rem)
const CTA_SPACING_EM := 0.22
const CTA_PADDING := Vector2(17.6, 8.0)        # padding .5rem 1.1rem
const CTA_MARGIN_TOP := 9.6                    # margin-top .6rem
const CTA_BORDER_PX := 1
const CTA_RADIUS := 4
const CTA_GLOW_BLUR := 24.0                    # box-shadow 0 0 24px rgba(68,170,255,.45)
const CTA_GLOW := Color(68.0 / 255.0, 170.0 / 255.0, 1.0, 0.45)
const GAP := 17.6                              # gap 1.1rem
const DELAYS_S := [0.0, 0.35, 0.8]             # title, tagline, CTA
const FADE_S := 0.6
const FADE_RISE_PX := 8.0                      # translateY(8px) -> none
const EASE_OUT := [0.0, 0.0, 0.58, 1.0]
const HALF := 0.5

var _items: Array[CssOpacity] = []
var _widths: Array[float] = []                 # each item's CSS width (the flex column centres it)
var _cta_glow: ColorRect
var _cta_box: Panel
var _cta_label: Label
var _elapsed := 0.0

func _ready() -> void:
	name = "TrailerTitle"
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	var title := GlowText.new()
	title.name = "Title"
	var title_font := _font(TITLE_PX, TITLE_SPACING_EM, true)
	title.configure(title_font, UiFont.css_size(TITLE_PX), UiTokens.ACCENT)
	title.label().add_theme_stylebox_override("normal", UiFont.trailing_spacing_style(title_font))
	title.mask_label().add_theme_stylebox_override("normal", UiFont.trailing_spacing_style(title_font))
	title.set_text(TITLE)
	title.set_shadows([CssShadow.make(TITLE_GLOW_BLUR, TITLE_GLOW)])
	_add_item(title, UiFont.css_width(TITLE, TITLE_PX, TITLE_SPACING_EM))
	_add_item(_label("Tagline", TAGLINE, TAGLINE_PX, TAGLINE_SPACING_EM, UiTokens.ACCENT_DIM, false),
		UiFont.css_width(TAGLINE, TAGLINE_PX, TAGLINE_SPACING_EM))
	_add_item(_build_cta(), UiFont.css_width(CTA, CTA_PX, CTA_SPACING_EM) + (CTA_PADDING.x + CTA_BORDER_PX) * 2.0)
	visible = false
	_apply()

## The beams have frozen: the title surfaces (web showTitle).
func show_card() -> void:
	visible = true
	_elapsed = 0.0
	_apply()

func advance(delta: float) -> void:
	_elapsed += delta
	_apply()

func items() -> Array[CssOpacity]:
	return _items

func _notification(what: int) -> void:
	if what == NOTIFICATION_RESIZED:
		_apply()

func _apply() -> void:
	if _items.size() < DELAYS_S.size():
		return
	var heights: Array[float] = []
	var column := GAP * (_items.size() - 1) + CTA_MARGIN_TOP
	for item in _items:
		var height := item.content.get_combined_minimum_size().y
		heights.append(height)
		column += height
	var top := (size.y - column) * HALF
	for i in _items.size():
		if i == _items.size() - 1:
			top += CTA_MARGIN_TOP
		var local := clampf((_elapsed - float(DELAYS_S[i])) / FADE_S, 0.0, 1.0)   # fill-mode both
		var eased := CssTiming.cubic_bezier(local, EASE_OUT)
		var item := _items[i]
		item.size = Vector2(_widths[i], heights[i])
		item.position = Vector2((size.x - _widths[i]) * HALF, top + FADE_RISE_PX * (1.0 - eased))
		item.set_opacity(eased)
		top += heights[i] + GAP

func _add_item(box: Control, width: float) -> void:
	var item := CssOpacity.new(box)
	item.name = "%sFade" % box.name
	add_child(item)
	_items.append(item)
	_widths.append(width)

## The outlined CTA: its outer glow, the 1 px accent border with 4 px corners, and the label inside the padding.
func _build_cta() -> Control:
	var cta := Control.new()
	cta.name = "Cta"
	cta.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_cta_label = _label("Label", CTA, CTA_PX, CTA_SPACING_EM, Color.WHITE, true)
	var inner := _cta_label.get_combined_minimum_size()
	var box := Vector2(UiFont.css_width(CTA, CTA_PX, CTA_SPACING_EM), inner.y) + (CTA_PADDING + Vector2.ONE * CTA_BORDER_PX) * 2.0
	cta.custom_minimum_size = box
	var reach := float(CssShadow.reach_px(CssShadow.make(CTA_GLOW_BLUR, CTA_GLOW)))
	_cta_glow = ColorRect.new()
	_cta_glow.name = "Glow"
	_cta_glow.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var material := ShaderMaterial.new()
	material.shader = GLOW_SHADER
	material.set_shader_parameter("box_px", box)
	material.set_shader_parameter("pad_px", reach)
	material.set_shader_parameter("sigma", CssShadow.sigma(CTA_GLOW_BLUR))
	material.set_shader_parameter("glow_color", CTA_GLOW)
	_cta_glow.material = material
	_cta_glow.position = -Vector2.ONE * reach
	_cta_glow.size = box + Vector2.ONE * reach * 2.0
	cta.add_child(_cta_glow)
	_cta_box = Panel.new()
	_cta_box.name = "Box"
	_cta_box.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var style := StyleBoxFlat.new()
	style.bg_color = Color.TRANSPARENT
	style.border_color = UiTokens.ACCENT
	style.set_border_width_all(CTA_BORDER_PX)
	style.set_corner_radius_all(CTA_RADIUS)
	_cta_box.add_theme_stylebox_override("panel", style)
	_cta_box.size = box
	cta.add_child(_cta_box)
	_cta_label.position = CTA_PADDING + Vector2.ONE * CTA_BORDER_PX
	cta.add_child(_cta_label)
	return cta

func _font(css_px: float, spacing_em: float, bold: bool) -> FontVariation:
	var font_size := UiFont.css_size(css_px)
	var spaced := UiFont.bold_spaced(spacing_em, font_size, css_px) if bold else UiFont.spaced(spacing_em, font_size, css_px)
	return UiFont.with_css_line(spaced, font_size, css_px)

func _label(node_name: String, text: String, css_px: float, spacing_em: float, color: Color, bold: bool) -> Label:
	var font := _font(css_px, spacing_em, bold)
	var label := Label.new()
	label.name = node_name
	label.text = text
	label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	label.add_theme_font_override("font", font)
	label.add_theme_font_size_override("font_size", UiFont.css_size(css_px))
	label.add_theme_color_override("font_color", color)
	label.add_theme_stylebox_override("normal", UiFont.trailing_spacing_style(font))
	return label
