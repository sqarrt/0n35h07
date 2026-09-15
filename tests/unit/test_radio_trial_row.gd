extends GutTest
## RadioTrialRow — web RadioPlayer trialRow (window capture: the strip 266×27, the button 93.44×19 flush right at y 8):
## the hairline and padding over the 19 px button, the day's counts in the text, the unlock action.

const WIDTH := 266.0

func _row() -> RadioTrialRow:
	var row := RadioTrialRow.new()
	add_child_autofree(row)
	row.show_trial(7, 4, true)
	row.size = Vector2(WIDTH, row.row_height())
	return row

func test_the_strip_is_the_hairline_the_padding_and_the_button() -> void:
	var row := _row()
	var button := row.unlock_button()
	assert_eq(button.get_combined_minimum_size().y, 19.0, "3 px padding and a 1 px border around the 11 px line")
	assert_eq(row.row_height(), 27.0)
	assert_eq(button.position.y, 8.0)
	assert_almost_eq(button.position.x + button.size.x, WIDTH, 0.01, "justify-content: space-between")
	var text := row.find_child("Text", true, false) as CssLabel
	var line := UiFont.fallback_line_px(RadioTrialRow.TEXT_PX, RadioTrialRow.SYMBOL_FAMILIES)
	var ascent := UiFont.fallback_ascent_px(RadioTrialRow.TEXT_PX, RadioTrialRow.SYMBOL_FAMILIES)
	assert_almost_eq(text.position.y + text.run().baseline(), 8.0 + roundf((19.0 - line) * 0.5) + ascent, 0.01,
		"the text's mixed line box centred on the button's height")

func test_the_text_counts_what_is_left_today() -> void:
	var row := _row()
	assert_eq(row.text(), "%s · ⟳ 7 · 💾 4" % I18n.t("radioFreeToday"))
	assert_eq(row.unlock_button().text, I18n.t("radioUnlock"))

func test_unlock_asks_for_the_store() -> void:
	var row := _row()
	watch_signals(row)
	row.unlock_button().pressed.emit()
	assert_signal_emitted(row, "unlock_requested")
	row.show_trial(0, 0, false)
	assert_false(row.unlock_button().visible)
