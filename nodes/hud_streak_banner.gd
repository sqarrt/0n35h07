class_name HudStreakBanner extends Control
## Streak banner — port of web StreakBanner.tsx + theme.css .streak-banner: "NAME: TIER" centred 64px from the top,
## 24px with 0.18em tracking, drawn as EffectText in the shooter's colour and flickering in and out over 2.05 s
## (ks-annShow on the wrapper).

const TOP := 64                              # web .streak-banner top
const FONT_SIZE := 24
const SPACING_EM := 0.18

var _row: HBoxContainer
var _text: EffectText
var _elapsed := 0.0

func _ready() -> void:
	name = "StreakBanner"
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	visible = false
	_row = HBoxContainer.new()
	_row.name = "Row"
	_row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_row.set_anchors_and_offsets_preset(Control.PRESET_TOP_WIDE)
	_row.offset_top = TOP
	_row.alignment = BoxContainer.ALIGNMENT_CENTER
	add_child(_row)
	_text = EffectText.new()
	_text.name = "Text"
	_text.auto_advance = false   # tick() drives the effect with the banner clock
	_text.configure_css(FONT_SIZE, SPACING_EM, Color.WHITE)
	_row.add_child(_text)

## Start a new announcement of `kind` for a player (replaces a running one, like the web re-keying the banner).
func announce(player: String, kind: String, color: Color) -> void:
	_text.show_text(HudModel.banner_text(player, Streak.tier_word(kind)), kind, color)
	_elapsed = 0.0
	visible = true
	_apply()

func tick(delta: float) -> void:
	if not visible:
		return
	_elapsed += delta
	if _elapsed >= HudModel.BANNER_DURATION_S:
		visible = false
		return
	_text.advance(delta)
	_apply()

func text() -> EffectText:
	return _text

func _apply() -> void:
	_text.modulate.a = HudModel.banner_opacity(_elapsed)
