extends GutTest
## RadioCodeView — the PROGRAM code box against the window capture (the box 254×588, its first text box 14 px down at
## x 16, a 17.265625 px pitch, the program wrapped at 212 px inside the 10 px scrollbar, the thumb 31 px long from 12 px
## down): the glow under the text, the wheel, a click asking for a copy, "—" without a program.

const EPS := 0.01
const BOX := Vector2(254.0, 588.0)
const FIXTURE := "res://tests/fixtures/radio_code_wrap.json"

func _view(code: String) -> RadioCodeView:
	var view := RadioCodeView.new()
	add_child_autofree(view)
	view.size = BOX
	view.show_code(code)
	return view

func _window_case() -> Dictionary:
	var web: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(FIXTURE))
	return web["cases"][0]

func test_the_program_wraps_inside_the_scrollbar_like_chrome() -> void:
	var web := _window_case()
	var view := _view(web["program"])
	assert_true(view.overflows())
	var lines := view.lines()
	assert_eq(lines.size(), int(web["lines"].back()["row"]) + 1, "623 rows at 212 px")
	assert_eq(lines[1][CssPreWrap.TEXT], web["lines"][1]["text"])

func test_rows_sit_on_chromes_layout_unit_pitch() -> void:
	var view := _view(_window_case()["program"])
	assert_almost_eq(RadioCodeLines.pitch(), 17.265625, EPS)
	assert_almost_eq(view.text_lines().row_origin(0).y, 14.0, EPS, "web: the first text box at y 63 in a box at 49")
	assert_almost_eq(view.text_lines().row_origin(1).y - view.text_lines().row_origin(0).y, 17.265625, EPS)
	assert_eq(view.text_lines().row_origin(0).x, 16.0)

func test_the_thumb_and_the_wheel() -> void:
	var web := _window_case()
	var view := _view(web["program"])
	var thumb := view.thumb_rect()
	assert_almost_eq(thumb.position.y, 12.0, EPS, "under the 12 px arrow button")
	assert_almost_eq(thumb.size.y, 564.0 * BOX.y / view.content_height(), EPS, "the track's share the box shows")
	assert_eq(thumb.size.x, RadioCodeView.THUMB_PX)
	var wheel := InputEventMouseButton.new()
	wheel.button_index = MOUSE_BUTTON_WHEEL_DOWN
	wheel.pressed = true
	view._gui_input(wheel)
	assert_almost_eq(view.scroll_offset(), RadioCodeView.WHEEL_PX, EPS)
	assert_gt(view.thumb_rect().position.y, thumb.position.y)

func test_a_click_asks_for_a_copy_and_nothing_shows_a_dash() -> void:
	var view := _view("")
	assert_eq(view.lines().map(func(line: Dictionary) -> String: return line[CssPreWrap.TEXT]), [RadioCodeView.EMPTY])
	assert_false(view.overflows())
	watch_signals(view)
	var click := InputEventMouseButton.new()
	click.button_index = MOUSE_BUTTON_LEFT
	click.pressed = true
	click.position = Vector2(40.0, 40.0)
	view._gui_input(click)
	assert_signal_emitted(view, "copy_requested")

func test_the_glow_blurs_the_same_lines_under_the_text() -> void:
	var view := _view("setcpm(122/4)")
	assert_eq(view.glow().layer_count(), 1)
	assert_eq(view.text_lines().get_index(), view.get_child_count() - 1, "the sharp text above the glow")
	var layer := view.glow().layers()[0].material as ShaderMaterial
	assert_almost_eq(float(layer.get_shader_parameter("sigma")), 3.0, EPS, "text-shadow blur 6px = 2σ")
	assert_eq(layer.get_shader_parameter("tint"), RadioCodeView.GLOW_COLOR)
