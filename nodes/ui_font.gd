class_name UiFont
## The web UI font: Share Tech Mono (@fontsource Latin face) with the project's Cyrillic face as a fallback, so
## Russian text renders in the same family as in the web build (web theme.css scopes both under one family).

const LATIN := "res://assets/fonts/share-tech-mono-latin-400-normal.woff2"
const CYRILLIC := "res://assets/fonts/share-tech-mono-cyrillic.ttf"

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
