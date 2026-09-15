class_name RadioTrialRow extends Control
## The expanded Radio player's free-trial strip — web RadioPlayer trialRow: 2 px under the row above, a 1 px white-8%
## hairline and 7 px of padding, then "Free today · ⟳ N · 💾 M" on the left (0.66rem accent-dim spaced 0.06em; Chrome
## takes ⟳ from Cambria Math, 💾 from Segoe UI Emoji) and the Unlock Radio button on the right (padding 3px 10px, radius
## 8, a 1 px accent-45% border on accent-12%, #bcd at 0.62rem spaced 0.06em), both centred on the button's height.

signal unlock_requested

const MARGIN_TOP := 2.0
const LINE_PX := 1.0
const PADDING_TOP := 7.0
const LINE := Color(1.0, 1.0, 1.0, 0.08)
const TEXT_PX := 10.56                          # 0.66rem
const TEXT_SPACING_EM := 0.06
const TEXT_FORMAT := "%s · ⟳ %d · 💾 %d"
const SYMBOL_FAMILIES := ["Cambria Math", "Segoe UI Emoji"]
const UNLOCK_PX := 9.92                         # 0.62rem
const UNLOCK_SPACING_EM := 0.06
const UNLOCK_PADDING := Vector2(10.0, 3.0)
const UNLOCK_RADIUS := 8
const UNLOCK_BORDER_ALPHA := 0.45
const UNLOCK_FILL_ALPHA := 0.12
const UNLOCK_TEXT := Color("#bbccdd")           # #bcd
const HALF := 0.5

var _text: CssLabel
var _unlock: CssButton

func _init() -> void:
	name = "Trial"
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	_text = CssLabel.new().styled("", TEXT_PX, TEXT_SPACING_EM, UiTokens.ACCENT_DIM, false,
		UiFont.base_with(SYMBOL_FAMILIES))
	_text.name = "Text"
	add_child(_text)
	_unlock = CssButton.new()
	_unlock.name = "Unlock"
	_unlock.focus_mode = Control.FOCUS_NONE
	_unlock.mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
	RadioButtons.dress(_unlock, RadioButtons.outline(Color(UiTokens.ACCENT, UNLOCK_BORDER_ALPHA), UNLOCK_RADIUS,
		Color(UiTokens.ACCENT, UNLOCK_FILL_ALPHA), UNLOCK_PADDING), UNLOCK_TEXT)
	RadioButtons.set_font(_unlock, UNLOCK_PX, UNLOCK_SPACING_EM, [])
	_unlock.text = I18n.t("radioUnlock")
	_unlock.pressed.connect(func() -> void: unlock_requested.emit())
	add_child(_unlock)
	resized.connect(_layout)

## Today's generations and saves left; the unlock button only when the DLC can be bought.
func show_trial(gens_left: int, saves_left: int, can_unlock: bool) -> void:
	_text.text = TEXT_FORMAT % [I18n.t("radioFreeToday"), gens_left, saves_left]
	_unlock.visible = can_unlock
	_layout()

func text() -> String:
	return _text.text

func unlock_button() -> CssButton:
	return _unlock

## The strip's height: the hairline, the padding and its tallest part (the button).
func row_height() -> float:
	return LINE_PX + PADDING_TOP + maxf(_unlock.get_combined_minimum_size().y, text_line())

## The text's line box: the UI font with the symbol faces' metrics as Chrome reads them (the 💾 raises it to 14 px).
func text_line() -> float:
	return UiFont.fallback_line_px(TEXT_PX, SYMBOL_FAMILIES)

## The text's baseline from the strip's top: the line box centred under the padding (flex align-items: center).
func text_baseline() -> float:
	var content_top := LINE_PX + PADDING_TOP
	return content_top + roundf((size.y - content_top - text_line()) * HALF) \
		+ UiFont.fallback_ascent_px(TEXT_PX, SYMBOL_FAMILIES)

func _get_minimum_size() -> Vector2:
	return Vector2(0.0, row_height())

func _draw() -> void:
	draw_rect(Rect2(0.0, 0.0, size.x, LINE_PX), LINE)

func _layout() -> void:
	var content_top := LINE_PX + PADDING_TOP
	var content_height := size.y - content_top
	var button := _unlock.get_combined_minimum_size()
	_unlock.size = button
	_unlock.position = Vector2(size.x - button.x, content_top + CssPixel.snap((content_height - button.y) * HALF))
	_text.size = _text.css_size()
	_text.position = Vector2(0.0, text_baseline() - _text.run().baseline())
	queue_redraw()
