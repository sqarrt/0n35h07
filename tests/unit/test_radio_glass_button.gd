extends GutTest
## RadioGlassButton — the expanded player's BACK bar (web backBtn, 300×36 in the window capture): two borders, 9 px of
## padding and the mixed line box of its ← glyph; the label centred; a press asks for the action.

const WIDTH := 300.0

func test_the_bar_is_the_padding_and_the_mixed_line() -> void:
	var bar := RadioGlassButton.new("← BACK")
	add_child_autofree(bar)
	var line := UiFont.fallback_line_px(RadioGlassButton.LABEL_PX, RadioGlassButton.SYMBOL_FAMILIES)
	assert_eq(bar.bar_height(), 2.0 + 18.0 + line)
	assert_eq(bar.get_combined_minimum_size().y, bar.bar_height())
	bar.size = Vector2(WIDTH, bar.bar_height())
	assert_eq(bar.button().size, bar.size, "the whole bar takes the click")
	assert_eq(bar.button().text, "← BACK")
	assert_eq(bar.button().alignment, HORIZONTAL_ALIGNMENT_CENTER)
	assert_eq(bar.button().css_baseline,
		1.0 + 9.0 + UiFont.fallback_ascent_px(RadioGlassButton.LABEL_PX, RadioGlassButton.SYMBOL_FAMILIES),
		"Chrome: the baseline at the mixed line's ascent under the border and padding")

func test_a_press_asks_for_the_action() -> void:
	var bar := RadioGlassButton.new("← BACK")
	add_child_autofree(bar)
	watch_signals(bar)
	bar.button().pressed.emit()
	assert_signal_emitted(bar, "pressed")
