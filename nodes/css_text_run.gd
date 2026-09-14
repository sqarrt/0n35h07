class_name CssTextRun extends RefCounted
## One line of the UI font laid out and drawn the way Chrome renders CSS letter-spacing (probes of 2026-09-15): every
## glyph sits at its fractional pen position — its advance, measured large like UiFont.css_width, plus the spacing, which
## follows the last glyph too — drawn at the fractional CSS size (a scaled draw rasterised at that size through
## oversampling), synthetic bold widening no advance, in a `line-height: normal` box with the ascent and descent each
## rounded (UiFont.with_css_line).

const HALF := 0.5

var text := ""
var css_px := 16.0
var spacing_em := 0.0
var bold := false
var face: Font = null                           # null: UiFont.base()

var _font: FontVariation                        # keeps the glyphs' font RIDs alive
var _glyphs: Array = []                         # shaped at the rounded size: font_rid, font_size, index, offset
var _pens := PackedFloat32Array()
var _width := 0.0
var _bold_ink_shift := 0.0                      # px at the rounded size: Godot's bold grows right, Chrome's both ways

func _init(run_text := "", font_px := 16.0, letter_spacing_em := 0.0, synthetic_bold := false,
		font_face: Font = null) -> void:
	text = run_text
	css_px = font_px
	spacing_em = letter_spacing_em
	bold = synthetic_bold
	face = font_face
	_layout()

## Chrome's inline box: every advance and every letter spacing, the last glyph's included.
func width() -> float:
	return _width

## Each glyph's pen position from the run's left edge, in CSS px.
func glyph_positions() -> PackedFloat32Array:
	return _pens

## How far left the synthetic bold glyphs draw (px at the rounded font size) to widen evenly like Chrome's.
func bold_ink_shift() -> float:
	return _bold_ink_shift

func baseline() -> int:
	return roundi(UiFont.ASCENT_EM * css_px)

func line_height() -> int:
	return baseline() + roundi(UiFont.DESCENT_EM * css_px)

## Where the run's line box sits in `content`, aligned like a Label: fractional across (Chrome's inline box), the native
## controls' whole-pixel centring down.
func placed(content: Rect2, horizontal := HORIZONTAL_ALIGNMENT_LEFT, vertical := VERTICAL_ALIGNMENT_TOP) -> Vector2:
	var free := content.size - Vector2(width(), line_height())
	var offset := Vector2.ZERO
	match horizontal:
		HORIZONTAL_ALIGNMENT_CENTER:
			offset.x = free.x * HALF
		HORIZONTAL_ALIGNMENT_RIGHT:
			offset.x = free.x
	match vertical:
		VERTICAL_ALIGNMENT_CENTER:
			offset.y = floorf(free.y * HALF)
		VERTICAL_ALIGNMENT_BOTTOM:
			offset.y = free.y
	return content.position + offset

## Draw the run with its line box's top-left corner at `origin`, in `item`'s coordinates.
func draw(item: CanvasItem, origin: Vector2, color: Color) -> void:
	if _glyphs.is_empty():
		return
	var server := TextServerManager.get_primary_interface()
	var scale := css_px / UiFont.css_size(css_px)
	var oversampling := scale * UiScale.of(item)
	item.draw_set_transform(origin, 0.0, Vector2.ONE * scale)
	var baseline_y := baseline() / scale
	var canvas := item.get_canvas_item()
	for i in _glyphs.size():
		var glyph: Dictionary = _glyphs[i]
		server.font_draw_glyph(glyph["font_rid"], canvas, glyph["font_size"],
			Vector2(_pens[i] / scale + _bold_ink_shift, baseline_y) + glyph["offset"], glyph["index"], color, oversampling)
	item.draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)

func _layout() -> void:
	var server := TextServerManager.get_primary_interface()
	var font_size := UiFont.css_size(css_px)
	_font = _face_at(font_size, bold)
	_bold_ink_shift = -UiFont.embolden_growth(_font.variation_embolden, font_size) * HALF
	var shaped := TextLine.new()
	shaped.add_string(text, _font, font_size, UiFont.SYSTEM_FALLBACK_LOCALE)
	_glyphs = server.shaped_text_get_glyphs(shaped.get_rid())
	var measured := TextLine.new()   # advances read large: their fractional em share, not the rounded size's
	measured.add_string(text, _face_at(UiFont.MEASURE_PX, false), UiFont.MEASURE_PX, UiFont.SYSTEM_FALLBACK_LOCALE)
	var large := server.shaped_text_get_glyphs(measured.get_rid())
	var spacing_px := spacing_em * css_px
	var pen := 0.0
	_pens = PackedFloat32Array()
	for i in _glyphs.size():
		_pens.append(pen)
		var advance: float = large[i]["advance"] if i < large.size() else _glyphs[i]["advance"] * UiFont.MEASURE_PX / font_size
		pen += advance * css_px / UiFont.MEASURE_PX + spacing_px
	_width = pen

## The face shaping this run: no letter spacing (the run spaces itself), synthetic bold when asked.
func _face_at(font_size: int, is_bold: bool) -> FontVariation:
	var variation := UiFont.bold_spaced(0.0, font_size, 0.0, face) if is_bold else UiFont.spaced(0.0, font_size, 0.0, face)
	variation.spacing_glyph = 0
	UiFont.mirror_fallbacks(variation)
	return variation
