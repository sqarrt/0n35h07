extends GutTest
## RadioGlassButton — the expanded player's glass bars (web backBtn: BACK 300×36 and the minimized PROGRAM bar 300×33
## in the window captures): two borders, 9 px of padding and the mixed line box of the label's symbol face (the ← of
## BACK), the UI font's alone without one; the label centred; a press asks for the action.

const WIDTH := 300.0

func test_back_is_the_padding_and_the_arrows_mixed_line() -> void:
	var bar := RadioGlassButton.new("← BACK", RadioGlassButton.ARROW_FAMILIES)
	add_child_autofree(bar)
	var line := UiFont.fallback_line_px(RadioGlassButton.LABEL_PX, RadioGlassButton.ARROW_FAMILIES)
	assert_eq(bar.bar_height(), 2.0 + 18.0 + line)
	assert_eq(bar.get_combined_minimum_size().y, bar.bar_height())
	bar.size = Vector2(WIDTH, bar.bar_height())
	assert_eq(bar.button().size, bar.size, "the whole bar takes the click")
	assert_eq(bar.button().text, "← BACK")
	assert_eq(bar.button().alignment, HORIZONTAL_ALIGNMENT_CENTER)
	assert_eq(bar.button().css_baseline,
		1.0 + 9.0 + UiFont.fallback_ascent_px(RadioGlassButton.LABEL_PX, RadioGlassButton.ARROW_FAMILIES),
		"Chrome: the baseline at the mixed line's ascent under the border and padding")

func test_a_plain_label_is_the_ui_fonts_line() -> void:
	var bar := RadioGlassButton.new("Program")
	add_child_autofree(bar)
	assert_eq(bar.bar_height(), 33.0, "web PROGRAM bar: 1 + 9 + the 13 px 0.74rem line + 9 + 1")

func test_a_press_asks_for_the_action() -> void:
	var bar := RadioGlassButton.new("← BACK", RadioGlassButton.ARROW_FAMILIES)
	add_child_autofree(bar)
	watch_signals(bar)
	bar.button().pressed.emit()
	assert_signal_emitted(bar, "pressed")
