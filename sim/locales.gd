class_name Locales
## The interface languages — port of web i18n LOCALES and detectLocale: the ids in the settings grid order with their
## native names, and the system language matched exactly, then by its two-letter prefix (pt-* → pt-BR), else English.

const NATIVE := {"en": "English", "fr": "Français", "it": "Italiano", "de": "Deutsch", "es": "Español",
	"zh-CN": "简体中文", "pt-BR": "Português (BR)", "ru": "Русский", "tr": "Türkçe", "pl": "Polski"}
const FALLBACK := "en"
const PREFIX_LENGTH := 2
const PROFILE_KEY := "locale"
const OS_SEPARATOR := "_"                   # OS.get_locale(): "pt_BR"; web navigator.languages: "pt-BR"
const WEB_SEPARATOR := "-"

static func ids() -> Array:
	return AppearanceConst.LOCALE_IDS

## web detectLocale over the requested languages, most preferred first.
static func detect(requested: Array) -> String:
	for raw in requested:
		var wanted := String(raw).replace(OS_SEPARATOR, WEB_SEPARATOR).to_lower()
		for id in ids():
			if String(id).to_lower() == wanted:
				return id
		var prefix := wanted.left(PREFIX_LENGTH)
		for id in ids():
			if String(id).to_lower().left(PREFIX_LENGTH) == prefix:
				return id
	return FALLBACK

## The profile's chosen language, or the system's when none was chosen (web I18nProvider initial).
static func of_profile(profile: Dictionary) -> String:
	if ids().has(profile.get(PROFILE_KEY)):
		return profile[PROFILE_KEY]
	return detect([OS.get_locale()])
