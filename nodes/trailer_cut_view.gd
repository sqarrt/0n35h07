class_name TrailerCutView extends Control
## A text cut between the trailer's play shots — port of theme.css `.trailer-cut` (the keyframes live in TrailerCut):
## the #04060c backdrop, the neon bar sweeping open across the middle, and the bold text slamming in and flying off — a
## GlowText (accent glow, the red / cyan split on the jolts) faded as one layer (CssOpacity) inside a Node2D that
## carries its translateX / skewX.

const BAR_SHADER := preload("res://assets/shaders/trailer_cut_bar.gdshader")
const MS_PER_S := 1000.0
const HALF := 0.5

var _bar: ColorRect
var _skew: Node2D
var _fade: CssOpacity
var _text: GlowText
var _font: FontVariation
var _duration_s := TrailerEdl.CUT_MS / MS_PER_S
var _elapsed := 0.0

func _ready() -> void:
	name = "TrailerCut"
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	var backdrop := ColorRect.new()
	backdrop.name = "Backdrop"
	backdrop.color = TrailerCut.BACKGROUND
	backdrop.mouse_filter = Control.MOUSE_FILTER_IGNORE
	backdrop.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(backdrop)
	_bar = ColorRect.new()
	_bar.name = "Bar"
	_bar.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var material := ShaderMaterial.new()
	material.shader = BAR_SHADER
	material.set_shader_parameter("color", UiTokens.ACCENT)
	_bar.material = material
	add_child(_bar)
	_skew = Node2D.new()
	_skew.name = "TextSkew"
	add_child(_skew)
	_font = UiFont.bold_spaced(TrailerCut.TEXT_SPACING_EM, TrailerCut.TEXT_PX)
	_text = GlowText.new()
	_text.name = "Text"
	_fade = CssOpacity.new(_text)
	_fade.name = "Fade"
	_skew.add_child(_fade)
	_text.configure(_font, TrailerCut.TEXT_PX, Color.WHITE)
	_text.set_shadows(TrailerCut.shadows(0.0))
	_set_spacing(_font.spacing_glyph, true)
	_apply()

## Start a cut showing `text` for `duration_ms` (web: the element re-keyed per shot, animation-duration inline).
func start(text: String, duration_ms: float) -> void:
	_text.set_text(text)
	_duration_s = duration_ms / MS_PER_S
	_elapsed = 0.0
	_apply()

func advance(delta: float) -> void:
	_elapsed += delta
	_apply()

func text() -> GlowText:
	return _text

func fade() -> CssOpacity:
	return _fade

func bar() -> ColorRect:
	return _bar

func text_transform() -> Transform2D:
	return _skew.transform

func _notification(what: int) -> void:
	if what == NOTIFICATION_RESIZED:
		_apply()

func _apply() -> void:
	if _text == null:
		return
	var fraction := _elapsed / _duration_s
	var state := TrailerCut.text(fraction)
	_set_spacing(UiFont.bold_spacing_px(float(state["spacing"]) * TrailerCut.TEXT_PX, _font.variation_embolden,
		TrailerCut.TEXT_PX))
	_text.set_shadows(TrailerCut.shadows(fraction))
	var box := _text.get_combined_minimum_size()
	_fade.size = box
	_skew.transform = TrailerCut.text_transform(state["offset_x"], state["skew"], (size - box) * HALF, box)
	_fade.set_opacity(state["opacity"])
	_apply_bar()

## translateY(-50%) scaleX(s) about the centre: the box and its shadow narrow along X together.
func _apply_bar() -> void:
	var state := TrailerCut.bar(_elapsed)
	var scale: float = state["scale"]
	var width := size.x * scale
	_bar.visible = width > 0.0
	var sigma := CssShadow.sigma(TrailerCut.BAR_GLOW_BLUR)
	var pad := Vector2.ONE * CssShadow.reach_px(CssShadow.make(TrailerCut.BAR_GLOW_BLUR, UiTokens.ACCENT))
	_bar.position = Vector2((size.x - width) * HALF, size.y * HALF - TrailerCut.BAR_HEIGHT * HALF) - pad
	_bar.size = Vector2(width, TrailerCut.BAR_HEIGHT) + pad * 2.0
	var material := _bar.material as ShaderMaterial
	material.set_shader_parameter("box_px", Vector2(width, TrailerCut.BAR_HEIGHT))
	material.set_shader_parameter("pad_px", pad)
	material.set_shader_parameter("sigma_px", Vector2(sigma * scale, sigma))
	_bar.modulate.a = state["opacity"]

## The letter spacing in whole pixels (Godot's is integral), keeping Chrome's line box and trailing spacing.
func _set_spacing(px: int, force := false) -> void:
	if px == _font.spacing_glyph and not force:
		return
	_font.spacing_glyph = px
	UiFont.mirror_fallbacks(_font)
	UiFont.with_css_line(_font, TrailerCut.TEXT_PX)
	var trailing := UiFont.trailing_spacing_style(_font)
	_text.label().add_theme_stylebox_override("normal", trailing)
	_text.mask_label().add_theme_stylebox_override("normal", trailing)
