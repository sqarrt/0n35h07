class_name BotAppearance
## Deterministic bot look from its name — port of web botAppearance.ts: same name, same seeded picks in the same
## order (colour, ball, windup, respawn, dash, shield, then the reserve colour drawn last from the rest of the palette).

static func from_name(bot_name: String) -> Dictionary:
	var rng := SeededRng.new(bot_name)
	var colors: Array = AppearanceConst.PLAYER_COLORS
	var color: String = _pick(rng, colors)
	var look := {
		"color": color,
		"ballModel": _pick(rng, AppearanceConst.BALL_MODELS),
		"windupStyle": _pick(rng, AppearanceConst.WINDUP_STYLES),
		"respawnStyle": _pick(rng, AppearanceConst.RESPAWN_STYLES),
		"dashStyle": _pick(rng, AppearanceConst.DASH_STYLES),
		"shieldStyle": _pick(rng, AppearanceConst.SHIELD_STYLES),
	}
	look["reserveColor"] = _pick(rng, colors.filter(func(c): return c != color))
	return look

static func _pick(rng: SeededRng, items: Array) -> String:
	return items[floori(rng.next() * items.size())]
