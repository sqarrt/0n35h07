extends GutTest
## A symbol glyph on a transparent button with `line-height: 1` (web theme.css .lobby-picker-x, .lobby-seat-cancel): the
## box is the font size plus the padding, however tall the fallback face that draws the glyph, and the glyph's advance
## wide; muted until hovered.

const EPS := 0.6
const GLYPH := "✕"
const PICKER_CLOSE := [16.0, Vector2(4.0, 2.0), 20.0]   # web .lobby-picker-x: a 20 px box
const SEAT_CANCEL := [13.0, Vector2(2.0, 2.0), 17.0]    # web .lobby-seat-cancel: a 17 px box

func _button(case: Array) -> GlyphButton:
	var button := GlyphButton.new(GLYPH, case[0], case[1])
	add_child_autofree(button)
	return button

func test_the_box_is_the_line_and_the_padding() -> void:
	for case in [PICKER_CLOSE, SEAT_CANCEL]:
		var button := _button(case)
		var box := button.get_combined_minimum_size()
		assert_almost_eq(box.y, case[2], EPS, "%s px, line-height 1" % case[0])
		assert_almost_eq(box.x, button.glyph_advance() + case[1].x * 2.0, EPS, "the glyph's advance and the sides")

func test_muted_until_hovered() -> void:
	var button := _button(PICKER_CLOSE)
	assert_eq(button.glyph_color(), UiTokens.MUTED)
	button.notification(Control.NOTIFICATION_MOUSE_ENTER)
	assert_eq(button.glyph_color(), UiTokens.TEXT, ":hover { color: var(--text) }")
