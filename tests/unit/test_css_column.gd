extends GutTest
## CssColumn: a flex column centred on both axes (web .screen / MatchEndedOverlay wrap) — children at their minimum
## size, CSS vertical margins that don't collapse, a gap between boxes, every box composited on whole pixels.

const EPS := 0.01
const SCREEN := Vector2(1280.0, 720.0)
const TITLE := Vector2(71.0, 27.0)
const BUTTON := Vector2(220.0, 44.0)
const TITLE_MARGIN_BOTTOM := 32.0
const BUTTON_MARGIN := 6.4

func _column() -> CssColumn:
	var viewport := SubViewport.new()
	viewport.size = Vector2i(SCREEN)
	add_child_autofree(viewport)
	var column := CssColumn.new()
	viewport.add_child(column)
	column.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	return column

func _box(min_size: Vector2) -> Control:
	var box := Control.new()
	box.custom_minimum_size = min_size
	return box

func test_margins_add_up_and_the_column_is_centred() -> void:
	var column := _column()
	var title := _box(TITLE)
	var first := _box(BUTTON)
	var second := _box(BUTTON)
	column.add(title, 0.0, TITLE_MARGIN_BOTTOM)
	column.add(first, BUTTON_MARGIN, BUTTON_MARGIN)
	column.add(second, BUTTON_MARGIN, BUTTON_MARGIN)
	await wait_process_frames(2)
	# web pause menu: MENU 27 + 32, then two 44 px buttons with 6.4 px margins that do not collapse
	var total := TITLE.y + TITLE_MARGIN_BOTTOM + 2.0 * (BUTTON.y + 2.0 * BUTTON_MARGIN)
	var top := (SCREEN.y - total) * 0.5
	assert_almost_eq(title.position.y, floorf(top + 0.5), EPS, "the title on a whole pixel")
	assert_almost_eq(title.position.x, floorf((SCREEN.x - TITLE.x) * 0.5 + 0.5), EPS, "centred across")
	var first_top := top + TITLE.y + TITLE_MARGIN_BOTTOM + BUTTON_MARGIN
	assert_almost_eq(first.position.y, floorf(first_top + 0.5), EPS)
	assert_almost_eq(second.position.y, floorf(first_top + BUTTON.y + 2.0 * BUTTON_MARGIN + 0.5), EPS,
		"adjacent margins add up (flex items don't collapse them)")
	assert_eq(first.size, BUTTON, "children keep their minimum size")

func test_a_left_margin_joins_the_centred_width() -> void:
	var column := _column()
	var logo := _box(Vector2(376.0, 72.0))
	column.add(logo, 0.0, 16.0, 19.2)
	await wait_process_frames(2)
	assert_almost_eq(logo.position.x, floorf((SCREEN.x - (376.0 + 19.2)) * 0.5 + 19.2 + 0.5), EPS,
		"web h1 margin-left 0.3em: the margin box is centred, the text sits after the margin")

func test_css_text_keeps_the_fraction_the_box_lost() -> void:
	var column := _column()
	var button := UiButton.new("PLAY", UiButton.PRIMARY)
	button.keep_minimum_size(Vector2(BUTTON.x + 1.0, 0.0))   # 221 px: centred at x 529.5, the border on 530
	column.add(button)
	await wait_process_frames(2)
	assert_almost_eq(button.position.x, 530.0, EPS)
	assert_almost_eq(button.css_offset_x, -0.5, EPS, "Chrome snaps the border and leaves the text at 529.5")
	var plain := _box(BUTTON)
	column.add(plain)
	await wait_process_frames(2)
	assert_false(CssColumn.CSS_OFFSET in plain, "other boxes are placed as before")

func test_gap_sits_between_boxes() -> void:
	var column := _column()
	column.gap = 26.0
	var a := _box(Vector2(100.0, 59.0))
	var b := _box(Vector2(80.0, 14.0))
	column.add(a)
	column.add(b)
	await wait_process_frames(2)
	var top := (SCREEN.y - (59.0 + 26.0 + 14.0)) * 0.5
	assert_almost_eq(a.position.y, floorf(top + 0.5), EPS)
	assert_almost_eq(b.position.y, floorf(top + 59.0 + 26.0 + 0.5), EPS)
	assert_almost_eq(column.get_combined_minimum_size().y, 59.0 + 26.0 + 14.0, EPS)
