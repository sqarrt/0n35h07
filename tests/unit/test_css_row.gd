extends GutTest
## CssRow — a flex row (web `display: flex; align-items: center; gap`): fractional minimum widths add up where
## BoxContainer rounds each one up, boxes land on whole pixels with the fraction handed to their text, a fixed width
## justifies the content to its start or end, and a nested row passes the fraction it lost on to its own children.

const EPS := 0.01
const SCREEN := Vector2i(640, 360)
const GAP := 7.0
const NAME_WIDTH := 73.92              # PARITY7 at 16 px spaced 0.12em
const FRAG_WIDTH := 8.4                # "0" at 15 px spaced 0.06em
const TALL := 24.0
const SIDE_WIDTH := 150.0
const NAME_PX := 16.0

func _row() -> CssRow:
	var viewport := SubViewport.new()
	viewport.size = SCREEN
	add_child_autofree(viewport)
	var row := CssRow.new()
	row.gap = GAP
	viewport.add_child(row)
	return row

func _text(width: float) -> CssLabel:
	var label := CssLabel.new().styled("", 16.0, 0.0, Color.WHITE)
	label.custom_minimum_size = Vector2(width, 0.0)
	return label

func test_fractional_widths_add_up() -> void:
	var row := _row()
	var player := _text(NAME_WIDTH)
	var frag := _text(FRAG_WIDTH)
	row.add_child(player)
	row.add_child(frag)
	await wait_process_frames(2)
	assert_almost_eq(row.get_combined_minimum_size().x, NAME_WIDTH + GAP + FRAG_WIDTH, EPS, "not ceil(73.92) + 7 + ceil(8.4)")
	assert_almost_eq(frag.position.x, CssPixel.snap(NAME_WIDTH + GAP), EPS, "the box on a whole pixel")
	assert_almost_eq(frag.css_offset_x, NAME_WIDTH + GAP - CssPixel.snap(NAME_WIDTH + GAP), EPS, "the text keeps the fraction")

func test_an_empty_text_takes_no_width() -> void:
	var row := _row()
	row.add_child(CssLabel.new().styled("", NAME_PX, 0.0, Color.WHITE))   # web: an empty span keeps only its gap
	var frag := _text(FRAG_WIDTH)
	row.add_child(frag)
	await wait_process_frames(2)
	assert_almost_eq(frag.position.x + frag.css_offset_x, GAP, EPS, "not the native empty Label's 1 px")

func test_children_are_centred_down_the_row() -> void:
	var row := _row()
	var short := _text(FRAG_WIDTH)
	var tall := Control.new()
	tall.custom_minimum_size = Vector2(FRAG_WIDTH, TALL)
	row.add_child(short)
	row.add_child(tall)
	await wait_process_frames(2)
	assert_almost_eq(row.size.y, TALL, EPS)
	assert_almost_eq(short.position.y, CssPixel.snap((TALL - short.size.y) * CssRow.HALF), EPS, "align-items: center")

func test_a_fixed_width_justifies_to_the_end() -> void:
	var row := _row()
	row.css_width = SIDE_WIDTH
	row.justify = CssRow.END
	var frag := _text(FRAG_WIDTH)
	row.add_child(_text(NAME_WIDTH))
	row.add_child(frag)
	await wait_process_frames(2)
	assert_almost_eq(row.get_combined_minimum_size().x, SIDE_WIDTH, EPS, "the side keeps its 150 px")
	assert_almost_eq(frag.position.x + frag.css_offset_x + FRAG_WIDTH, SIDE_WIDTH, EPS, "justify-content: flex-end")

func test_a_nested_row_passes_its_fraction_on() -> void:
	var row := _row()
	row.add_child(_text(NAME_WIDTH))
	var inner := CssRow.new()
	inner.gap = GAP
	var frag := _text(FRAG_WIDTH)
	inner.add_child(frag)
	row.add_child(inner)
	await wait_process_frames(2)
	var css_x := NAME_WIDTH + GAP
	assert_almost_eq(inner.css_offset_x, css_x - inner.position.x, EPS)
	assert_almost_eq(frag.position.x + inner.position.x + frag.css_offset_x, css_x, EPS, "the text at the CSS place")
