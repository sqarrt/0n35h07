extends GutTest
## CssPreWrap — the PROGRAM panel's lines against Chrome's own (web parity-capture-radio-code.mjs: two programs wrapped
## at 212 px in the window and 396 px fullscreen, 623 and 193 visual lines): the same text on the same visual rows,
## hanging spaces, Blink's pair breaks and anywhere-breaks included.

const FIXTURE := "res://tests/fixtures/radio_code_wrap.json"

var _web: Dictionary
var _widths := {}

func before_all() -> void:
	_web = JSON.parse_string(FileAccess.get_file_as_string(FIXTURE))

func _advance(character: String) -> float:
	if not _widths.has(character):
		_widths[character] = UiFont.css_width(character, float(_web["css_px"]), float(_web["spacing_em"]))
	return _widths[character]

func test_chromes_lines_row_for_row() -> void:
	for case in _web["cases"]:
		var got := CssPreWrap.lines(case["program"], float(case["width"]), _advance)
		for line in case["lines"]:
			var row := int(line["row"])
			assert_true(row < got.size(), "%s row %d exists" % [case["capture"], row])
			if row >= got.size():
				break
			assert_eq(got[row][CssPreWrap.START], int(line["start"]), "%s row %d start" % [case["capture"], row])
			assert_eq(got[row][CssPreWrap.TEXT], line["text"], "%s row %d text" % [case["capture"], row])
		assert_eq(got.size(), int(case["lines"].back()["row"]) + 1, "%s: nothing after the last line" % case["capture"])

func test_blinks_pairs_break_after_a_quote_before_an_opening_bracket() -> void:
	assert_true(CssPreWrap.can_break("\"", "<"))
	assert_true(CssPreWrap.can_break("\"", "["))
	assert_false(CssPreWrap.can_break("a", "b"))

func test_spaces_hang_and_an_empty_line_is_a_line() -> void:
	var one := func(_character: String) -> float: return 1.0
	var got := CssPreWrap.lines("ab  cd\n\nefgh", 3.0, one)
	assert_eq(got.map(func(line: Dictionary) -> String: return line[CssPreWrap.TEXT]), ["ab  ", "cd", "", "efg", "h"])
