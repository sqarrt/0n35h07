extends GutTest
## CssFieldText — Chrome's `<input>` text over a native LineEdit: the field's own text, placeholder, caret and selection
## turn transparent, the overlay's run is the value (or the placeholder when empty) with fractional spacing, aligned
## like the field inside its content box, and the caret sits at its glyph's pen.

const EPS := 0.01
const FONT_PX := 20.8
const SPACING_EM := 0.1
const WIDTH := 256.0
const HEIGHT := 44.0

func _field(text := "PARITY7", alignment := HORIZONTAL_ALIGNMENT_LEFT) -> LineEdit:
	var line_edit := LineEdit.new()
	line_edit.text = text
	line_edit.placeholder_text = "Name"
	line_edit.alignment = alignment
	line_edit.add_theme_color_override("font_color", UiTokens.TEXT)
	line_edit.add_theme_color_override("font_placeholder_color", UiTokens.MUTED)
	var box := StyleBoxEmpty.new()
	box.content_margin_left = 17.0
	box.content_margin_right = 17.0
	for state in ["normal", "focus"]:
		line_edit.add_theme_stylebox_override(state, box)
	add_child_autofree(line_edit)
	line_edit.size = Vector2(WIDTH, HEIGHT)
	return line_edit

func test_the_field_hides_its_own_text_and_the_overlay_draws_it() -> void:
	var line_edit := _field()
	var overlay := CssFieldText.attach(line_edit, FONT_PX, SPACING_EM)
	assert_eq(line_edit.get_theme_color("font_color"), CssFieldText.TRANSPARENT)
	assert_eq(line_edit.get_theme_color("caret_color"), CssFieldText.TRANSPARENT)
	assert_eq(overlay.text_color, UiTokens.TEXT, "the field's colour moves to the overlay")
	assert_eq(overlay.run().text, "PARITY7")
	assert_almost_eq(overlay.run().width(), UiFont.css_width("PARITY7", FONT_PX, SPACING_EM), EPS, "Chrome's run width")
	assert_almost_eq(overlay.text_origin().x, 17.0, EPS, "the content box's left")

func test_an_empty_field_shows_the_placeholder_in_its_colour() -> void:
	var line_edit := _field("")
	var overlay := CssFieldText.attach(line_edit, FONT_PX, SPACING_EM)
	assert_true(overlay.showing_placeholder())
	assert_eq(overlay.run().text, "Name")
	assert_eq(overlay.placeholder_color, UiTokens.MUTED)
	line_edit.insert_text_at_caret("x")
	assert_false(overlay.showing_placeholder())
	assert_eq(overlay.run().text, "x")

func test_text_set_from_code_is_noticed_without_a_signal() -> void:
	var line_edit := _field()
	var overlay := CssFieldText.attach(line_edit, FONT_PX, SPACING_EM)
	overlay.sync()
	assert_false(overlay.sync(), "nothing changed")
	line_edit.text = "EX82R"
	assert_true(overlay.sync(), "text set from code emits no text_changed")
	assert_eq(overlay.run().text, "EX82R")
	line_edit.caret_column = 1
	assert_true(overlay.sync(), "a caret move")

func test_a_centred_field_centres_the_run_and_the_caret_follows_the_glyphs() -> void:
	var line_edit := _field("EX82R", HORIZONTAL_ALIGNMENT_CENTER)
	var overlay := CssFieldText.attach(line_edit, FONT_PX, SPACING_EM)
	var content_width := WIDTH - 34.0
	var width := overlay.run().width()
	assert_almost_eq(overlay.text_origin().x, 17.0 + (content_width - width) * 0.5, EPS, "text-align: center")
	line_edit.caret_column = 2
	assert_almost_eq(overlay.caret_x(), overlay.text_origin().x + overlay.run().glyph_positions()[2], EPS)
	line_edit.caret_column = 5
	assert_almost_eq(overlay.caret_x(), overlay.text_origin().x + width, EPS, "after the last glyph")
