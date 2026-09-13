extends GutTest
## Core HUD look parity with web Crosshair / ShieldBrackets / DashIndicator: colours, opacities and fill lengths.

const HALF := 0.5
const EPS := 0.001

func test_crosshair_ring_is_dim_while_charging_and_cyan_when_ready() -> void:
	assert_eq(HudModel.crosshair_ring_color(HALF), Color("#006666"))
	assert_eq(HudModel.crosshair_ring_color(1.0), Color("#00ffff"))

func test_shield_brackets_grow_from_the_vertex_while_the_shield_recharges() -> void:
	var charging := HudModel.shield_bracket_look(HALF, false)
	assert_eq(charging["color"], Color("#1a2a6e"))
	assert_almost_eq(charging["opacity"], 0.5, EPS)
	assert_almost_eq(charging["length"], HudModel.BRACKET_ARM * HALF, EPS)
	var ready := HudModel.shield_bracket_look(1.0, false)
	assert_eq(ready["color"], Color("#4169e1"))
	assert_almost_eq(ready["opacity"], 0.85, EPS)
	assert_almost_eq(ready["length"], HudModel.BRACKET_ARM, EPS)
	var active := HudModel.shield_bracket_look(1.0, true)
	assert_eq(active["color"], Color("#66aaff"))
	assert_almost_eq(active["opacity"], 1.0, EPS)

func test_dash_bars_fill_from_the_centre_and_turn_green_when_ready() -> void:
	var charging := HudModel.dash_bar_look(HALF)
	assert_eq(charging["color"], Color("#0c4d28"))
	assert_almost_eq(charging["opacity"], 0.55, EPS)
	assert_almost_eq(charging["fill"], HALF, EPS)
	var ready := HudModel.dash_bar_look(1.0)
	assert_eq(ready["color"], Color("#2e9d57"))
	assert_almost_eq(ready["opacity"], 1.0, EPS)
	assert_almost_eq(ready["fill"], 1.0, EPS)

func test_ui_font_is_share_tech_mono_with_cyrillic_fallback() -> void:
	var font := UiFont.base()
	assert_true(font.has_char("0".unicode_at(0)), "Latin face")
	assert_eq(font.fallbacks.size(), 1, "one fallback: the Cyrillic face")
	assert_true(font.fallbacks[0].has_char("Я".unicode_at(0)), "Cyrillic glyphs come from the fallback")
