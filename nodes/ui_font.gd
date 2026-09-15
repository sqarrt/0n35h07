class_name UiFont
## The web UI font: Share Tech Mono (@fontsource Latin face) with the project's Cyrillic face as a fallback, so
## Russian text renders in the same family as in the web build (web theme.css scopes both under one family).

const LATIN := "res://assets/fonts/share-tech-mono-latin-400-normal.woff2"
const CYRILLIC := "res://assets/fonts/share-tech-mono-cyrillic.ttf"
## web --ui-font fallbacks for Chinese (the face has no CJK glyphs). Only faces that show Chinese take them: a system
## fallback raises every line's ascent in Godot.
const CJK_FAMILIES := ["Noto Sans SC", "PingFang SC", "Microsoft YaHei"]
const CJK_FALLBACK_COUNT := 2                  # base_cjk(): the Cyrillic face, then the system CJK face
## Godot's own system fallback (glyphs no face of the chain has) picks its face by the tool locale — Yu Gothic for
## Chinese under English. Chrome takes the --ui-font stack's Microsoft YaHei in every language, and like Godot's system
## fallback grows only the lines that use it; the port has no Godot translations, so the locale only steers that pick.
const SYSTEM_FALLBACK_LOCALE := "zh_CN"
## web index.css: html[lang="zh-CN"] .btn, .seg { letter-spacing: 0.05em } — wide Latin tracking bloats CJK labels.
const CJK_CONTROL_SPACING_EM := 0.05
const MEASURE_PX := 1000                       # fractional em metrics are read at a large size
const FITTING_GLYPH := "0"                     # the monospaced face: one advance fits a whole run
const FITTING_RUN := 100                       # glyphs measured together: a lone glyph's line box rounds its width up

## Chrome's synthetic bold (the face has no bold weight): Skia grows the outline by the font size times a ratio
## interpolated from 1/24 at 9 px to 1/32 at 36 px; Godot's embolden grows it by strength x size / 16 px.
const FAKE_BOLD_SIZES := Vector2(9.0, 36.0)
const FAKE_BOLD_RATIOS := Vector2(1.0 / 24.0, 1.0 / 32.0)
const EMBOLDEN_UNIT_SIZE := 16.0
const EMBOLDEN_ADVANCE_DIVISOR := 64.0         # Godot widens an emboldened advance by embolden × size / 64 px
const EMBOLDEN_GROWTH_DIVISOR := 16.0          # ... and its glyph bitmap by embolden × size / 16 px
## The Latin face's hhea metrics (units per em 1000: ascender 885, descender -242).
const ASCENT_EM := 0.885
const DESCENT_EM := 0.242

static var _base: FontFile
static var _bases_with := {}                  # "family,family" -> the base face with those system fallbacks
static var _systems := {}                     # "family,family" -> the system face of that list
static var _measure_fonts := {}                # face -> its unspaced variation at MEASURE_PX

## The shared base face (Latin + Cyrillic fallback).
static func base() -> FontFile:
	if _base == null:
		TranslationServer.set_locale(SYSTEM_FALLBACK_LOCALE)
		_base = (load(LATIN) as FontFile).duplicate() as FontFile   # don't mutate the shared imported resource
		var fallbacks: Array[Font] = [load(CYRILLIC) as Font]
		_base.fallbacks = fallbacks
	return _base

## The base face that can also show Chinese (the settings language grid's 简体中文).
static func base_cjk() -> FontFile:
	return base_with(CJK_FAMILIES)

## The base face with system `families` after the Cyrillic fallback — the --ui-font stack's later faces, for text only
## they can show (Chinese, or a symbol Chrome takes from `monospace`). One face per family list.
static func base_with(families: Array) -> FontFile:
	var key := ",".join(families)
	if not _bases_with.has(key):
		TranslationServer.set_locale(SYSTEM_FALLBACK_LOCALE)
		var face := (load(LATIN) as FontFile).duplicate() as FontFile
		var fallbacks: Array[Font] = [load(CYRILLIC) as Font, system_face(families)]
		face.fallbacks = fallbacks
		_bases_with[key] = face
	return _bases_with[key]

## The system face of `families` (the first one installed), one per family list — base_with's fallback, and the face a
## line box takes its metrics from.
static func system_face(families: Array) -> Font:
	var key := ",".join(families)
	if not _systems.has(key):
		var face: Font = _collection_face(families[0]) if not families.is_empty() else null
		if face == null:
			var system := SystemFont.new()
			system.font_names = PackedStringArray(families)
			face = system
		_systems[key] = face
	return _systems[key]

## A family that is a later face of its collection file (Cambria Math in cambria.ttc), opened by its index: SystemFont
## would draw the collection's first face (Cambria). null for any other family.
static func _collection_face(family: String) -> Font:
	var index := SystemFontMetrics.face_index(family)
	if index <= 0:
		return null
	var file := FontFile.new()
	if file.load_dynamic_font(OS.get_system_font_path(family)) != OK:
		return null
	var face := FontVariation.new()
	face.base_font = file
	face.variation_face_index = index
	return face

## The letter spacing of a `.btn` / `.seg` label in the active locale (an inline letter spacing keeps its own).
static func control_spacing_em(latin_em: float) -> float:
	return CJK_CONTROL_SPACING_EM if I18n.is_cjk() else latin_em

## A run's CSS width: Chrome's fractional advances (measured at MEASURE_PX, as Godot rounds them per size) plus the
## letter spacing Chrome adds after every glyph. `face` draws the glyphs (the UI font by default).
static func css_width(text: String, css_px: float, spacing_em := 0.0, face: Font = null) -> float:
	if not _measure_fonts.has(face):
		_measure_fonts[face] = spaced(0.0, MEASURE_PX, 0.0, face)
	var line := TextLine.new()
	line.add_string(text, _measure_fonts[face], MEASURE_PX, SYSTEM_FALLBACK_LOCALE)
	return line.get_size().x * css_px / MEASURE_PX + text.length() * spacing_em * css_px

## The letter spacing (px, before rounding) that keeps a monospaced run as wide as Chrome's at a fractional CSS size:
## Chrome's advance plus its spacing, less Godot's advance at the rounded size (Godot rounds advances per size). Where
## the spacing alone rounds the wrong way — 12.5 px spaced 0.04em: 0.5 → 1 px on a 13 px advance of 7 — a line runs a
## pixel per glyph too wide and wraps where Chrome's does not.
static func fitted_spacing(css_px: float, spacing_em: float, font_size: int, face: Font = null) -> float:
	var godot := TextLine.new()
	godot.add_string(FITTING_GLYPH.repeat(FITTING_RUN), spaced(0.0, font_size, 0.0, face), font_size)
	return css_width(FITTING_GLYPH, css_px, spacing_em, face) - godot.get_size().x / FITTING_RUN

## A fractional CSS font size (rem sizes such as 0.7rem = 11.2 px) as the nearest Godot font size.
static func css_size(css_px: float) -> int:
	return roundi(css_px)

## The base face with web letter-spacing converted to pixels (em × the CSS font size, `css_px` when it is fractional).
static func spaced(letter_spacing_em: float, font_size: int, css_px := 0.0, face: Font = null) -> FontVariation:
	var variation := FontVariation.new()
	variation.base_font = face if face != null else base()
	variation.spacing_glyph = roundi(letter_spacing_em * _px(font_size, css_px))
	mirror_fallbacks(variation)
	return variation

## The spaced face in CSS font-weight bold. Chrome's synthetic bold keeps every advance, Godot's embolden widens each
## one (embolden_advance): that share comes out of the letter spacing.
static func bold_spaced(letter_spacing_em: float, font_size: int, css_px := 0.0, face: Font = null) -> FontVariation:
	var variation := spaced(letter_spacing_em, font_size, css_px, face)
	variation.variation_embolden = fake_bold_embolden(font_size)
	variation.spacing_glyph = bold_spacing_px(letter_spacing_em * _px(font_size, css_px), variation.variation_embolden,
		font_size)
	mirror_fallbacks(variation)
	return variation

## Whole-pixel letter spacing for an emboldened face that adds up to Chrome's `spacing_px` per glyph.
static func bold_spacing_px(spacing_px: float, embolden: float, font_size: int) -> int:
	return roundi(spacing_px - embolden_advance(embolden, font_size))

## How much Godot's TextServer widens each glyph advance of a face emboldened by `embolden` at `font_size`.
static func embolden_advance(embolden: float, font_size: int) -> float:
	return embolden * font_size / EMBOLDEN_ADVANCE_DIVISOR

## How much wider the emboldened glyph bitmap grows — to the right only, its left edge stays (probe
## embolden_offset_probe.gd: 64 px at 0.5 → 2 px); Skia strokes Chrome's synthetic bold evenly on both sides.
static func embolden_growth(embolden: float, font_size: int) -> float:
	return embolden * font_size / EMBOLDEN_GROWTH_DIVISOR

## Glyphs from the fallback faces (Cyrillic, CJK) take the variation's letter spacing and synthetic bold too: with its
## own fallbacks empty, a FontVariation falls back to the base face's plain fonts, which carry neither (Chrome spaces and
## emboldens every glyph of the family). Call again after changing the spacing or the embolden.
static func mirror_fallbacks(variation: FontVariation) -> void:
	var mirrored: Array[Font] = []
	for fallback in variation.base_font.fallbacks:
		var copy := FontVariation.new()
		if fallback is FontVariation:   # a collection's face: the same file and face, not a variation of a variation
			copy.base_font = (fallback as FontVariation).base_font
			copy.variation_face_index = (fallback as FontVariation).variation_face_index
		else:
			copy.base_font = fallback
		copy.spacing_glyph = variation.spacing_glyph
		copy.variation_embolden = variation.variation_embolden
		mirrored.append(copy)
	variation.fallbacks = mirrored

## Chrome's `line-height: normal` box: the ascent and the descent each rounded to a pixel, where Godot rounds them up.
## Shifting the variation's top / bottom spacing by the difference puts the text box and the baseline where the
## browser has them (16 px: 14 + 4 = 18, not 15 + 4). A fractional CSS size (`css_px`) keeps its own line box
## (20.8 px: 18 + 5 = 23, where 21 px would give 24).
static func with_css_line(variation: FontVariation, font_size: int, css_px := 0.0) -> FontVariation:
	var px := _px(font_size, css_px)
	variation.spacing_top = roundi(ASCENT_EM * px) - roundi(base().get_ascent(font_size))
	variation.spacing_bottom = roundi(DESCENT_EM * px) - roundi(base().get_descent(font_size))
	for fallback in variation.fallbacks:   # Cyrillic lines too: Chrome sizes them by the family's Latin face
		(fallback as FontVariation).spacing_top = variation.spacing_top
		(fallback as FontVariation).spacing_bottom = variation.spacing_bottom
	return variation

## Chrome's `line-height: normal` box for text drawn by another face (a system symbol font): its ascent and descent,
## measured large for their fractional em share, each rounded to a pixel where Godot rounds them up.
static func with_face_line(variation: FontVariation, font_size: int, face: Font) -> FontVariation:
	variation.spacing_top = roundi(face.get_ascent(MEASURE_PX) * font_size / MEASURE_PX) - roundi(face.get_ascent(font_size))
	variation.spacing_bottom = roundi(face.get_descent(MEASURE_PX) * font_size / MEASURE_PX) \
		- roundi(face.get_descent(font_size))
	return variation

## Chrome's `line-height: normal` box for a line that also draws glyphs from `face` (a system fallback such as the ▸ in
## Consolas): the larger of the two faces' ascents and of their descents, each rounded to a pixel.
static func mixed_line_px(css_px: float, face: Font) -> int:
	return mixed_ascent_px(css_px, face) + mixed_descent_px(css_px, face)

## That line box's baseline from its top: the larger rounded ascent.
static func mixed_ascent_px(css_px: float, face: Font) -> int:
	return maxi(roundi(ASCENT_EM * css_px), roundi(face.get_ascent(MEASURE_PX) * css_px / MEASURE_PX))

static func mixed_descent_px(css_px: float, face: Font) -> int:
	return maxi(roundi(DESCENT_EM * css_px), roundi(face.get_descent(MEASURE_PX) * css_px / MEASURE_PX))

## A line of the UI font that also draws glyphs from system `families`, with those faces' metrics as Chrome reads them
## (SystemFontMetrics: OS/2 win or typo, not Godot's hhea) — Godot's own where no font file can be read.
static func fallback_line_px(css_px: float, families: Array) -> int:
	return fallback_ascent_px(css_px, families) + fallback_descent_px(css_px, families)

static func fallback_ascent_px(css_px: float, families: Array) -> int:
	return maxi(roundi(ASCENT_EM * css_px), roundi(_fallback_em(families).x * css_px))

static func fallback_descent_px(css_px: float, families: Array) -> int:
	return maxi(roundi(DESCENT_EM * css_px), roundi(_fallback_em(families).y * css_px))

## The largest ascent and descent (em) among the families' faces.
static func _fallback_em(families: Array) -> Vector2:
	var largest := Vector2.ZERO
	var read := false
	for family in families:
		var metrics := SystemFontMetrics.line_em(family)
		if not metrics.is_empty():
			read = true
			largest = largest.max(Vector2(metrics[SystemFontMetrics.ASCENT], metrics[SystemFontMetrics.DESCENT]))
	if read:
		return largest
	var face := system_face(families)
	return Vector2(face.get_ascent(MEASURE_PX), face.get_descent(MEASURE_PX)) / MEASURE_PX

static func _px(font_size: int, css_px: float) -> float:
	return css_px if css_px > 0.0 else float(font_size)

## A Label box holding Chrome's trailing letter spacing: CSS adds the spacing after the last glyph too (the box is that
## much wider, the text that much left of a centred box's middle); Godot's line drops it.
static func trailing_spacing_style(font: FontVariation) -> StyleBoxEmpty:
	var style := StyleBoxEmpty.new()
	style.content_margin_right = font.spacing_glyph
	return style

static func fake_bold_embolden(font_size: int) -> float:
	var t := clampf((font_size - FAKE_BOLD_SIZES.x) / (FAKE_BOLD_SIZES.y - FAKE_BOLD_SIZES.x), 0.0, 1.0)
	return lerpf(FAKE_BOLD_RATIOS.x, FAKE_BOLD_RATIOS.y, t) * EMBOLDEN_UNIT_SIZE
