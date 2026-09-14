extends GutTest
## CssButton — a Button whose label is a CssTextRun: `text` still reads and writes the label while the native text stays
## empty, the box grows to the run plus its margins but keeps the caller's minimum, and the label follows the state's
## box and colour.

const EPS := 0.01
const SCREEN := Vector2i(640, 360)
const FONT_PX := 16.0
const SPACING_EM := 0.18
const PADDING := 10.0
const WIDE := 400.0
const SHIFT := 2.0
const BORDER_BELOW := 1.0

func _button(label: String) -> CssButton:
	var viewport := SubViewport.new()
	viewport.size = SCREEN
	add_child_autofree(viewport)
	var button := CssButton.new()
	button.text = label
	for state in CssButton.STYLES.values():
		var box := StyleBoxEmpty.new()
		box.set_content_margin_all(PADDING)
		button.add_theme_stylebox_override(state, box)
	var font_size := UiFont.css_size(FONT_PX)
	button.add_theme_font_override("font", UiFont.with_css_line(UiFont.spaced(SPACING_EM, font_size), font_size))
	button.add_theme_font_size_override("font_size", font_size)
	button.set_css_font(FONT_PX, SPACING_EM)
	viewport.add_child(button)
	return button

func test_text_is_the_label_the_native_text_is_empty() -> void:
	var button := _button("PLAY")
	assert_eq(button.text, "PLAY")
	assert_eq(button.get_text(), "", "the run draws it")
	button.text = "SETTINGS"
	assert_eq(button.run().text, "SETTINGS")

func test_the_box_is_the_run_plus_its_margins() -> void:
	var button := _button("SETTINGS")
	var run := CssTextRun.new("SETTINGS", FONT_PX, SPACING_EM)
	await wait_process_frames(1)
	assert_almost_eq(button.get_combined_minimum_size().x, run.width() + PADDING * 2.0, EPS)
	button.custom_minimum_size.x = WIDE
	assert_almost_eq(button.get_combined_minimum_size().x, WIDE, EPS, "the caller's minimum width wins when wider")
	assert_almost_eq(button.custom_minimum_size.x, WIDE, EPS)

func test_the_label_follows_the_pressed_box() -> void:
	var button := _button("GO")
	await wait_process_frames(1)
	var idle := button.text_origin()
	var pressed := button.get_theme_stylebox("pressed")
	pressed.content_margin_top += SHIFT
	pressed.content_margin_bottom -= SHIFT
	button.toggle_mode = true
	button.button_pressed = true
	assert_eq(button.get_draw_mode(), BaseButton.DRAW_PRESSED)
	assert_almost_eq(button.text_origin().y, idle.y + SHIFT, EPS)

func test_the_baseline_is_where_the_native_button_puts_it() -> void:
	var button := _button("YouTube — @watooh")
	for state in CssButton.STYLES.values():   # a link's box: nothing above the text, a 1 px border below
		var box := StyleBoxEmpty.new()
		box.content_margin_bottom = BORDER_BELOW
		button.add_theme_stylebox_override(state, box)
	await wait_process_frames(1)
	var line := TextLine.new()
	line.add_string(button.text, button.get_theme_font("font"), button.get_theme_font_size("font_size"))
	var inner := button.size.y - BORDER_BELOW
	var native := roundf((inner - line.get_size().y) * CssButton.HALF + line.get_line_ascent())
	assert_almost_eq(button.text_origin().y + button.run().baseline(), native, EPS,
		"button.cpp: the text line centred, unrounded, its ascent down to the baseline")

func test_the_colour_is_the_states() -> void:
	var button := _button("GO")
	button.add_theme_color_override("font_color", Color.RED)
	button.add_theme_color_override("font_disabled_color", Color.BLUE)
	assert_eq(button.text_color(), Color.RED)
	button.disabled = true
	assert_eq(button.text_color(), Color.BLUE)
