class_name HudStreakBanner extends Control
## Streak banner — port of web StreakBanner.tsx + theme.css .streak-banner: "NAME: TIER" centred 64px from the top,
## 24px with 0.18em tracking, flickering in and out over 2.05 s (ks-annShow). Per-tier text effects and player colours
## arrive in H3.

const TOP := 64                              # web .streak-banner top
const FONT_SIZE := 24
const SPACING_EM := 0.18
const TEXT_COLOR := Color("#cfe6ff")         # web --text until player colours / EffectText arrive

var _text: Label
var _elapsed := 0.0

func _ready() -> void:
	name = "StreakBanner"
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	visible = false
	_text = Label.new()
	_text.name = "Text"
	_text.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_text.set_anchors_and_offsets_preset(Control.PRESET_TOP_WIDE)
	_text.offset_top = TOP
	_text.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_text.add_theme_font_override("font", UiFont.spaced(SPACING_EM, FONT_SIZE))
	_text.add_theme_font_size_override("font_size", FONT_SIZE)
	_text.add_theme_color_override("font_color", TEXT_COLOR)
	add_child(_text)

## Start a new announcement (replaces a running one, like the web re-keying the banner).
func announce(player: String, tier_word: String) -> void:
	_text.text = HudModel.banner_text(player, tier_word)
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
	_apply()

func _apply() -> void:
	_text.modulate.a = HudModel.banner_opacity(_elapsed)
