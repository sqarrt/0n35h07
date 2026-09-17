class_name GlowText extends Control
## Text with CSS text-shadow glows that really blur. Godot Label shadows stay sharp, so each shadow is a separable
## Gaussian of the glyph mask (CssGlow: the mask in a SubViewport, a horizontal pass per shadow, a vertical pass and tint
## on screen). The first CSS shadow paints on top and the sharp text above all of them. Lays out exactly like its text.

const HORIZONTAL := CssGlow.HORIZONTAL
const VERTICAL := CssGlow.VERTICAL

## What the box lost to whole pixels across (set by the layout): the text and its glyph mask keep the CSS place.
var css_offset_x := 0.0:
	set(value):
		css_offset_x = value
		_label.css_offset_x = value
		_mask_label.css_offset_x = value

var _label: CssLabel
var _mask_label: CssLabel
var _glow: CssGlow

func _init() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	_label = _new_label("Text")
	_label.minimum_size_changed.connect(_resize)   # the glyph box changes once theme fonts apply
	add_child(_label)
	_mask_label = _new_label("MaskText")
	_mask_label.add_theme_color_override("font_color", Color.WHITE)
	_glow = CssGlow.new(self, _mask_label)

## Font, size and text colour for the text and its glyph mask.
func configure(font: Font, font_size: int, color: Color) -> void:
	for l in [_label, _mask_label]:
		l.add_theme_font_override("font", font)
		l.add_theme_font_size_override("font_size", font_size)
	set_color(color)
	_resize()

## The CSS font instead: `css_px` spaced `spacing_em` (synthetic bold, drawn by `face`), the text and its glyph mask laid
## out and drawn as Chrome's runs.
func configure_css(css_px: float, spacing_em: float, color: Color, bold := false, face: Font = null) -> void:
	for l in [_label, _mask_label]:
		(l as CssLabel).setup(css_px, spacing_em, bold, face)
	set_color(color)
	_resize()

func set_text(text: String) -> void:
	if text == _label.text:
		return
	_label.text = text
	_mask_label.text = text
	_resize()

func set_color(color: Color) -> void:
	_label.add_theme_color_override("font_color", color)

## CssShadow dictionaries, first on top. The same count only updates the glows; the padding never shrinks, so
## animated glows don't reallocate their viewports.
func set_shadows(shadows: Array) -> void:
	var rebuilt := shadows.size() != _glow.layer_count()
	_glow.set_shadows(shadows)
	if rebuilt:
		move_child(_label, get_child_count() - 1)
	_resize()

func _notification(what: int) -> void:
	# The mask label lives outside the tree until a shadow needs it; free it with the node so it never leaks.
	if what == NOTIFICATION_PREDELETE:
		_glow.release()

func label() -> CssLabel:
	return _label

func mask_label() -> CssLabel:
	return _mask_label

func layers() -> Array[TextureRect]:
	return _glow.layers()

func layer_count() -> int:
	return _glow.layer_count()

func padding() -> int:
	return _glow.padding()

func _resize() -> void:
	var text_size := _label.get_combined_minimum_size()   # a CSS run's box lives in the label's custom minimum
	custom_minimum_size = text_size
	_label.position = Vector2.ZERO
	_label.size = text_size
	_glow.resize(text_size)

func _new_label(node_name: String) -> CssLabel:
	var l := CssLabel.new()
	l.name = node_name
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return l
