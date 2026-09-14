class_name TrailerSkipButton extends Button
## The trailer's SKIP — port of theme.css .trailer-skip: a small dim button 20 px from the right and 18 px from the
## bottom that brightens on hover and fades away with the idle cursor (opacity 0.3 s ease; no clicks while hidden).

const TEXT := "SKIP ▸"
const SYMBOL_FAMILIES := ["Consolas"]          # --ui-font ends in `monospace`: Chrome on Windows draws the ▸ in Consolas
const FONT_PX := 12.8                          # 0.8rem
const SPACING_EM := 0.16
const PADDING := Vector2(14.4, 8.0)            # padding .5rem .9rem
const RIGHT := 20.0
const BOTTOM := 18.0
const FILL := Color(8.0 / 255.0, 12.0 / 255.0, 20.0 / 255.0, 0.6)   # rgba(8,12,20,.6)
const BORDER_PX := 1
const RADIUS := 4
const FADE_S := 0.3
const EASE := [0.25, 0.1, 0.25, 1.0]           # CSS `ease`
## Godot box state -> [border, text colour key, text colour]; :active has no rule, so a press keeps the hover look.
const LOOKS := {
	"normal": [UiTokens.SURFACE_LINE, "font_color", UiTokens.ACCENT_DIM],
	"hover": [UiTokens.ACCENT_DIM, "font_hover_color", UiTokens.ACCENT],
	"pressed": [UiTokens.SURFACE_LINE, "font_pressed_color", UiTokens.ACCENT_DIM],
	"hover_pressed": [UiTokens.ACCENT_DIM, "font_hover_pressed_color", UiTokens.ACCENT],
}

var _fade := CssTransition.new(FADE_S, EASE)

func _ready() -> void:
	name = "Skip"
	text = TEXT
	focus_mode = Control.FOCUS_NONE
	var font_size := UiFont.css_size(FONT_PX)
	var face := UiFont.base_with(SYMBOL_FAMILIES)
	var font := UiFont.with_css_line(UiFont.spaced(SPACING_EM, font_size, FONT_PX, face), font_size, FONT_PX)
	add_theme_font_override("font", font)
	add_theme_font_size_override("font_size", font_size)
	for state in LOOKS:
		var look: Array = LOOKS[state]
		var style := StyleBoxFlat.new()
		style.bg_color = FILL
		style.border_color = look[0]
		style.set_border_width_all(BORDER_PX)
		style.set_corner_radius_all(RADIUS)
		style.content_margin_left = PADDING.x
		style.content_margin_right = PADDING.x + font.spacing_glyph   # Chrome's trailing letter spacing
		style.content_margin_top = PADDING.y
		style.content_margin_bottom = PADDING.y
		add_theme_stylebox_override(state, style)
		add_theme_color_override(look[1], look[2])
	add_theme_stylebox_override("focus", StyleBoxEmpty.new())
	var line := UiFont.mixed_line_px(FONT_PX, face.fallbacks.back())   # the ▸'s face raises the line box
	var box := Vector2(UiFont.css_width(TEXT, FONT_PX, SPACING_EM, face), line) + (PADDING + Vector2.ONE * BORDER_PX) * 2.0
	set_anchors_preset(Control.PRESET_BOTTOM_RIGHT)
	offset_left = -RIGHT - box.x
	offset_top = -BOTTOM - box.y
	offset_right = -RIGHT
	offset_bottom = -BOTTOM
	_fade.snap(0.0)
	set_idle(true)
	_apply()

## Hidden while the cursor is idle (web .is-hidden: opacity 0, pointer-events none).
func set_idle(idle: bool) -> void:
	_fade.set_target(0.0 if idle else 1.0)
	mouse_filter = Control.MOUSE_FILTER_IGNORE if idle else Control.MOUSE_FILTER_STOP

func tick(delta: float) -> void:
	_fade.advance(delta)
	_apply()

func _apply() -> void:
	modulate.a = _fade.value
