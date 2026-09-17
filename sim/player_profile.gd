class_name PlayerProfile
## The local player's profile — port of web settings.ts (PlayerProfile, randomProfile, sanitize). Stored as a
## Dictionary with the web's JSON keys so a profile written by either build reads the same.

## First-run profile: a generated model name and a random colour pair (web randomProfile).
static func random(rng: Callable) -> Dictionary:
	var colors: Array = AppearanceConst.PLAYER_COLORS
	var primary: String = colors[floori(rng.call() * colors.size())]
	var others := colors.filter(func(c): return c != primary)
	var reserve: String = others[floori(rng.call() * others.size())]
	var volumes: Dictionary = AppearanceConst.VOLUME_DEFAULTS
	return {"name": ModelNames.generate(rng), "primaryColor": primary, "reserveColor": reserve,
		"defaultView": AppearanceConst.VIEW_FIRST_PERSON, "searchRole": AppearanceConst.ROLE_BOTH,
		"ballModel": AppearanceConst.BALL_MODELS[0], "windupStyle": AppearanceConst.WINDUP_STYLES[0],
		"respawnStyle": AppearanceConst.RESPAWN_STYLES[0], "dashStyle": AppearanceConst.DASH_STYLES[0],
		"shieldStyle": AppearanceConst.SHIELD_STYLES[0], "postProcessing": true, "showFps": false,
		"showSpeed": false, "menuGlow": true, "audioViz": true, "volumeMaster": volumes["master"],
		"volumeMusic": volumes["music"], "volumeSfx": volumes["sfx"], "volumeMenuMusic": volumes["menuMusic"],
		"radioEnabled": false, "volumeRadio": volumes["radio"],
		"connectTimeoutSec": AppearanceConst.CONNECT_TIMEOUT_DEFAULT}

## Coerce any stored data into a valid profile (web sanitize): trimmed name (or a generated one), palette colours
## with reserve ≠ primary, known styles, booleans / volumes / options with their defaults.
static func sanitize(p: Dictionary, rng: Callable) -> Dictionary:
	var colors: Array = AppearanceConst.PLAYER_COLORS
	var raw_name := (p.get("name") as String).strip_edges() if p.get("name") is String else ""
	var profile_name := raw_name.substr(0, AppearanceConst.NAME_MAX)
	if profile_name == "":
		profile_name = ModelNames.generate(rng)
	var primary: String = p["primaryColor"] if colors.has(p.get("primaryColor")) else colors[0]
	var reserve: String = p["reserveColor"] if colors.has(p.get("reserveColor")) else colors[1]
	if reserve == primary:
		reserve = colors.filter(func(c): return c != primary)[0]
	var volumes: Dictionary = AppearanceConst.VOLUME_DEFAULTS
	var out := {
		"name": profile_name, "primaryColor": primary, "reserveColor": reserve,
		"defaultView": AppearanceConst.VIEW_THIRD_PERSON if p.get("defaultView") == AppearanceConst.VIEW_THIRD_PERSON \
			else AppearanceConst.VIEW_FIRST_PERSON,
		"searchRole": AppearanceConst.ROLE_CLIENT if p.get("searchRole") == AppearanceConst.ROLE_CLIENT \
			else AppearanceConst.ROLE_BOTH,
		"ballModel": _one_of(p.get("ballModel"), AppearanceConst.BALL_MODELS),
		"windupStyle": _one_of(p.get("windupStyle"), AppearanceConst.WINDUP_STYLES),
		"respawnStyle": _one_of(p.get("respawnStyle"), AppearanceConst.RESPAWN_STYLES),
		"dashStyle": _one_of(p.get("dashStyle"), AppearanceConst.DASH_STYLES),
		"shieldStyle": _one_of(p.get("shieldStyle"), AppearanceConst.SHIELD_STYLES),
		"postProcessing": _bool(p.get("postProcessing"), true),
		"showFps": _bool(p.get("showFps"), false),
		"showSpeed": _bool(p.get("showSpeed"), false),
		"menuGlow": _bool(p.get("menuGlow"), true),
		"audioViz": _bool(p.get("audioViz"), true),
		"volumeMaster": _volume(p.get("volumeMaster"), volumes["master"]),
		"volumeMusic": _volume(p.get("volumeMusic"), volumes["music"]),
		"volumeSfx": _volume(p.get("volumeSfx"), volumes["sfx"]),
		"volumeMenuMusic": _volume(p.get("volumeMenuMusic"), volumes["menuMusic"]),
		"radioEnabled": _bool(p.get("radioEnabled"), false),
		"volumeRadio": _volume(p.get("volumeRadio"), volumes["radio"]),
		"connectTimeoutSec": _timeout(p.get("connectTimeoutSec")),
	}
	if p.get("radioDlcOwned") is bool:
		out["radioDlcOwned"] = p["radioDlcOwned"]
	var trial = p.get("radioTrial")
	if trial is Dictionary and trial.get("day") is String and _non_negative(trial.get("gens")) \
			and _non_negative(trial.get("saves")):
		out["radioTrial"] = {"day": trial["day"], "gens": floori(trial["gens"]), "saves": floori(trial["saves"])}
	if AppearanceConst.LOCALE_IDS.has(p.get("locale")):
		out["locale"] = p["locale"]
	if is_valid_ball_art(p.get("ballArt")):
		out["ballArt"] = p["ballArt"]
	return out

## web decodeBallArt as a validity check: 88 base64 characters decoding to 64 bytes.
static func is_valid_ball_art(value) -> bool:
	if not (value is String) or (value as String).length() != AppearanceConst.BALL_ART_BASE64_LEN:
		return false
	if RegEx.create_from_string("^[A-Za-z0-9+/]+={0,2}$").search(value) == null:
		return false
	return Marshalls.base64_to_raw(value).size() == AppearanceConst.BALL_ART_BYTES

static func _one_of(value, options: Array) -> String:
	return value if options.has(value) else options[0]

static func _bool(value, fallback: bool) -> bool:
	return value if value is bool else fallback

static func _is_number(value) -> bool:
	return (value is float or value is int) and is_finite(float(value))

static func _volume(value, fallback: float) -> float:
	return clampf(float(value), 0.0, 1.0) if _is_number(value) else fallback

## One of the connect-timeout options (JSON numbers arrive as floats; 30.0 counts as 30), else the default.
static func _timeout(value) -> int:
	if _is_number(value) and float(value) == floorf(float(value)) \
			and AppearanceConst.CONNECT_TIMEOUT_OPTIONS.has(int(value)):
		return int(value)
	return AppearanceConst.CONNECT_TIMEOUT_DEFAULT

static func _non_negative(value) -> bool:
	return _is_number(value) and float(value) >= 0.0
