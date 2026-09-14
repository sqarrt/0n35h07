class_name UiFont
## The web UI font: Share Tech Mono (@fontsource Latin face) with the project's Cyrillic face as a fallback, so
## Russian text renders in the same family as in the web build (web theme.css scopes both under one family).

const LATIN := "res://assets/fonts/share-tech-mono-latin-400-normal.woff2"
const CYRILLIC := "res://assets/fonts/share-tech-mono-cyrillic.ttf"

## Chrome's synthetic bold (the face has no bold weight): Skia grows the outline by the font size times a ratio
## interpolated from 1/24 at 9 px to 1/32 at 36 px; Godot's embolden grows it by strength x size / 16 px.
const FAKE_BOLD_SIZES := Vector2(9.0, 36.0)
const FAKE_BOLD_RATIOS := Vector2(1.0 / 24.0, 1.0 / 32.0)
const EMBOLDEN_UNIT_SIZE := 16.0
## The Latin face's hhea metrics (units per em 1000: ascender 885, descender -242).
const ASCENT_EM := 0.885
const DESCENT_EM := 0.242

static var _base: FontFile

## The shared base face (Latin + Cyrillic fallback).
static func base() -> FontFile:
	if _base == null:
		_base = (load(LATIN) as FontFile).duplicate() as FontFile   # don't mutate the shared imported resource
		var fallbacks: Array[Font] = [load(CYRILLIC) as Font]
		_base.fallbacks = fallbacks
	return _base

## The base face with web letter-spacing converted to pixels (em × font size).
static func spaced(letter_spacing_em: float, font_size: int) -> FontVariation:
	var variation := FontVariation.new()
	variation.base_font = base()
	variation.spacing_glyph = roundi(letter_spacing_em * font_size)
	return variation

## The spaced face in CSS font-weight bold.
static func bold_spaced(letter_spacing_em: float, font_size: int) -> FontVariation:
	var variation := spaced(letter_spacing_em, font_size)
	variation.variation_embolden = fake_bold_embolden(font_size)
	return variation

## Chrome's `line-height: normal` box: the ascent and the descent each rounded to a pixel, where Godot rounds them up.
## Shifting the variation's top / bottom spacing by the difference puts the text box and the baseline where the
## browser has them (16 px: 14 + 4 = 18, not 15 + 4).
static func with_css_line(variation: FontVariation, font_size: int) -> FontVariation:
	variation.spacing_top = roundi(ASCENT_EM * font_size) - roundi(base().get_ascent(font_size))
	variation.spacing_bottom = roundi(DESCENT_EM * font_size) - roundi(base().get_descent(font_size))
	return variation

## A Label box holding Chrome's trailing letter spacing: CSS adds the spacing after the last glyph too (the box is that
## much wider, the text that much left of a centred box's middle); Godot's line drops it.
static func trailing_spacing_style(font: FontVariation) -> StyleBoxEmpty:
	var style := StyleBoxEmpty.new()
	style.content_margin_right = font.spacing_glyph
	return style

static func fake_bold_embolden(font_size: int) -> float:
	var t := clampf((font_size - FAKE_BOLD_SIZES.x) / (FAKE_BOLD_SIZES.y - FAKE_BOLD_SIZES.x), 0.0, 1.0)
	return lerpf(FAKE_BOLD_RATIOS.x, FAKE_BOLD_RATIOS.y, t) * EMBOLDEN_UNIT_SIZE
