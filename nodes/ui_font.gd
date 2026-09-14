class_name UiFont
## The web UI font: Share Tech Mono (@fontsource Latin face) with the project's Cyrillic face as a fallback, so
## Russian text renders in the same family as in the web build (web theme.css scopes both under one family).

const LATIN := "res://assets/fonts/share-tech-mono-latin-400-normal.woff2"
const CYRILLIC := "res://assets/fonts/share-tech-mono-cyrillic.ttf"
## web --ui-font fallbacks for Chinese (the face has no CJK glyphs). Only faces that show Chinese take them: a system
## fallback raises every line's ascent in Godot.
const CJK_FAMILIES := ["Noto Sans SC", "PingFang SC", "Microsoft YaHei"]
const CJK_FALLBACK_COUNT := 2                  # base_cjk(): the Cyrillic face, then the system CJK face

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

## The shared base face (Latin + Cyrillic fallback).
static func base() -> FontFile:
	if _base == null:
		_base = (load(LATIN) as FontFile).duplicate() as FontFile   # don't mutate the shared imported resource
		var fallbacks: Array[Font] = [load(CYRILLIC) as Font]
		_base.fallbacks = fallbacks
	return _base

## The base face that can also show Chinese (the settings language grid's 简体中文).
static func base_cjk() -> FontFile:
	if _base_cjk == null:
		_base_cjk = (load(LATIN) as FontFile).duplicate() as FontFile
		var cjk := SystemFont.new()
		cjk.font_names = PackedStringArray(CJK_FAMILIES)
		var fallbacks: Array[Font] = [load(CYRILLIC) as Font, cjk]
		_base_cjk.fallbacks = fallbacks
	return _base_cjk

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
