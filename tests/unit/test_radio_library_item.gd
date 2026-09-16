extends GutTest
## RadioLibraryItem — web RadioExplorer `.rexp-it`: the name wraps inside 96 px (`word-break: break-word`), so a long
## title grows the cell instead of running over the cell beside it.

const EPS := 0.01
const SHORT := "Twin"
const LONG := "Ashen Drift Over The Fathom Lagoon"
const UNBROKEN := "AshenDriftOverTheFathomLagoonXS17"

func _item(item_name: String) -> RadioLibraryItem:
	var item := RadioLibraryItem.new({RadioLibrary.KIND: RadioLibrary.TRACK, RadioLibrary.NAME: item_name,
		RadioLibrary.PATH: "%s.json" % item_name})
	add_child_autofree(item)
	return item

func test_a_short_name_stays_on_one_line() -> void:
	var item := _item(SHORT)
	assert_eq(item.label_lines().size(), 1)
	assert_eq(item.label().label().text, SHORT)

func test_a_long_name_wraps_and_grows_the_cell() -> void:
	var short_item := _item(SHORT)
	var item := _item(LONG)
	assert_gt(item.label_lines().size(), 1, "web .lbl: max-width 96 px, word-break: break-word")
	assert_almost_eq(item.natural_height(), short_item.natural_height()
		+ (item.label_lines().size() - 1) * RadioLibraryItem.line_px(), EPS, "the cell grows by the extra lines")
	for line: GlowText in item.label_lines():
		assert_lte(line.get_combined_minimum_size().x, RadioLibraryItem.LABEL_MAX_WIDTH + EPS, "inside 96 px")

func test_a_word_too_long_for_a_line_is_broken_inside() -> void:
	var item := _item(UNBROKEN)
	assert_gt(item.label_lines().size(), 1, "break-word cuts a word that fits no line of its own")
	var joined := ""
	for line: GlowText in item.label_lines():
		joined += line.label().text
	assert_eq(joined, UNBROKEN, "every letter is still there")

func test_the_lines_are_centred_under_the_icon() -> void:
	var item := _item(LONG)
	await wait_process_frames(2)   # the boxes settle with the theme fonts
	var top := RadioLibraryItem.BORDER_PX + RadioLibraryItem.PADDING.y + item.icon().size.y + RadioLibraryItem.GAP
	for i in item.label_lines().size():
		var line: GlowText = item.label_lines()[i]
		assert_almost_eq(line.position.x + line.css_offset_x, (RadioLibraryItem.WIDTH - line.size.x) * 0.5, EPS,
			"line %d centred" % i)
		assert_almost_eq(line.position.y, top + i * RadioLibraryItem.line_px()
			+ floorf((RadioLibraryItem.line_px() - line.get_combined_minimum_size().y) * 0.5), EPS, "line %d" % i)
