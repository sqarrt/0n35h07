extends GutTest
## CssLabel — a Label whose visible text is a CssTextRun (Chrome's fractional letter spacing): the Label API stays (text,
## alignment, theme colour), its own glyphs are hidden, the box is the run's width over the CSS line box, and a new
## text lays the run out again.

const EPS := 0.01
const SCREEN := Vector2i(640, 360)
const FIELD_PX := 11.2                 # web settings field label: 0.7rem spaced 0.15em
const FIELD_SPACING_EM := 0.15
const WIDE := 300.0

func _label(text: String) -> CssLabel:
	var viewport := SubViewport.new()
	viewport.size = SCREEN
	add_child_autofree(viewport)
	var label := CssLabel.new()
	label.text = text
	label.setup(FIELD_PX, FIELD_SPACING_EM)
	viewport.add_child(label)
	return label

func test_the_box_is_the_run_over_the_line_box() -> void:
	var label := _label("FIRST PERSON")
	var run := CssTextRun.new("FIRST PERSON", FIELD_PX, FIELD_SPACING_EM)
	assert_almost_eq(label.get_combined_minimum_size().x, run.width(), EPS, "Chrome's fractional width")
	assert_almost_eq(label.get_combined_minimum_size().y, float(run.line_height()), EPS)

func test_its_own_glyphs_are_hidden() -> void:
	var label := _label("NAME")
	assert_eq(label.visible_characters, 0, "the run draws the text")
	assert_eq(label.text, "NAME", "the Label API keeps the text")

func test_a_new_text_lays_the_run_out_again() -> void:
	var label := _label("NAME")
	var short := label.get_combined_minimum_size().x
	label.text = "LANGUAGE"
	await wait_process_frames(1)
	assert_almost_eq(label.get_combined_minimum_size().x, CssTextRun.new("LANGUAGE", FIELD_PX, FIELD_SPACING_EM).width(),
		EPS)
	assert_gt(label.get_combined_minimum_size().x, short)

func test_styled_sets_text_font_and_colour_at_once() -> void:
	var viewport := SubViewport.new()
	viewport.size = SCREEN
	add_child_autofree(viewport)
	var label := CssLabel.new().styled("NAME", FIELD_PX, FIELD_SPACING_EM, Color.RED, true)
	viewport.add_child(label)
	assert_eq(label.text, "NAME")
	assert_eq(label.get_theme_color("font_color"), Color.RED)
	assert_true(label.run().bold)
	assert_almost_eq(label.get_combined_minimum_size().x, CssTextRun.new("NAME", FIELD_PX, FIELD_SPACING_EM, true).width(),
		EPS)
	assert_eq(label.mouse_filter, Control.MOUSE_FILTER_IGNORE, "a caption lets clicks through")

func test_alignment_places_the_run() -> void:
	var label := _label("NAME")
	label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	label.size = Vector2(WIDE, label.get_combined_minimum_size().y)
	var width := CssTextRun.new("NAME", FIELD_PX, FIELD_SPACING_EM).width()
	assert_almost_eq(label.text_origin().x, (WIDE - width) * 0.5, EPS, "centred like the CSS inline box")
	label.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	assert_almost_eq(label.text_origin().x, WIDE - width, EPS)
