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

## Chrome's synthetic bold (the face has no bold weight): Skia grows the outline by the font size times a ratio
## interpolated from 1/24 at 9 px to 1/32 at 36 px; Godot's embolden grows it by strength x size / 16 px.
const FAKE_BOLD_SIZES := Vector2(9.0, 36.0)
const FAKE_BOLD_RATIOS := Vector2(1.0 / 24.0, 1.0 / 32.0)
const EMBOLDEN_UNIT_SIZE := 16.0
## The Latin face's hhea metrics (units per em 1000: ascender 885, descender -242).
const ASCENT_EM := 0.885
const DESCENT_EM := 0.242

static var _base: FontFile
static var _base_cjk: FontFile
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
	if _base_cjk == null:
		TranslationServer.set_locale(SYSTEM_FALLBACK_LOCALE)
		_base_cjk =(load(LATIN) as FontFile).duplicate() as FontFile
		var cjk := SystemFont.new()
		cjk.font_names = PackedStringArray(CJK_FAMILIES)
		var fallbacks: Array[Font] = [load(CYRILLIC) as Font, cjk]
		_base_cjk.fallbacks = fallbacks
	return _base_cjk

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

## The spaced face in CSS font-weight bold.
static func bold_spaced(letter_spacing_em: float, font_size: int, css_px := 0.0, face: Font = null) -> FontVariation:
	var variation := spaced(letter_spacing_em, font_size, css_px, face)
	variation.variation_embolden = fake_bold_embolden(font_size)
	mirror_fallbacks(variation)
	return variation

## Glyphs from the fallback faces (Cyrillic, CJK) take the variation's letter spacing and synthetic bold too: with its
## own fallbacks empty, a FontVariation falls back to the base face's plain fonts, which carry neither (Chrome spaces and
## emboldens every glyph of the family). Call again after changing the spacing or the embolden.
static func mirror_fallbacks(variation: FontVariation) -> void:
	var mirrored: Array[Font] = []
	for fallback in variation.base_font.fallbacks:
		var copy := FontVariation.new()
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
