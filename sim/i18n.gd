class_name I18n
## The interface translations — port of web i18n DICTS / useT: one dictionary per locale (assets/i18n/<id>.json, written
## from the web dictionaries by web-reference/scripts/export-i18n.mjs), the active locale every text is read in, and the
## web's parameterised entries as "{0}", "{1}" templates. A missing entry shows the English one, then the key.

const DICTIONARY_PATH := "res://assets/i18n/%s.json"
const CJK_LOCALE := "zh-CN"

static var _locale := Locales.FALLBACK
static var _dictionaries := {}

## The active locale (web I18nProvider setLocale); an unknown id is English.
static func use_locale(id: String) -> void:
	_locale = id if Locales.ids().has(id) else Locales.FALLBACK

static func locale() -> String:
	return _locale

## Simplified Chinese: the one locale with its own CSS tracking (web index.css html[lang="zh-CN"]).
static func is_cjk() -> bool:
	return _locale == CJK_LOCALE

## The active locale's text for a web dictionary key, its template filled with `args` in order.
static func t(key: String, args: Array = []) -> String:
	var text := String(dictionary(_locale).get(key, dictionary(Locales.FALLBACK).get(key, key)))
	return text if args.is_empty() else text.format(args)

## A locale's whole dictionary, loaded once.
static func dictionary(id: String) -> Dictionary:
	if not _dictionaries.has(id):
		var json := JSON.new()   # parse(), not parse_string(): a broken file must not raise an engine error
		var ok := json.parse(FileAccess.get_file_as_string(DICTIONARY_PATH % id)) == OK and json.data is Dictionary
		_dictionaries[id] = json.data if ok else {}
	return _dictionaries[id]
