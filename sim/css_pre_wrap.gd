class_name CssPreWrap
## Chrome's visual lines for `white-space: pre-wrap; overflow-wrap: anywhere` text (the Radio's PROGRAM panel), the
## greedy breaker the web captures show: every hard line fills with as many characters as fit (each advance with the
## letter spacing after it); a run of spaces that would overflow hangs at the end of the line; otherwise the line breaks
## at its last soft wrap opportunity — after a space, or between a pair Blink's ASCII table allows
## (assets/text/chrome_line_breaks.json, exported from Chromium by web-reference/scripts/export-chrome-line-breaks.mjs);
## with none, anywhere: after the last character that fits. An empty hard line is a visual line too.

const TABLE_PATH := "res://assets/text/chrome_line_breaks.json"
const BREAKABLE := "1"
const SPACE := " "
const NEWLINE := "\n"
const FIT_EPS := 0.0001
const START := "start"
const TEXT := "text"

static var _chars := ""
static var _rows := PackedStringArray()

## [{start, text}] per visual line; `advance` is one character's CSS width with its letter spacing.
static func lines(text: String, width: float, advance: Callable) -> Array:
	var out := []
	var start := 0
	for paragraph in text.split(NEWLINE):
		if paragraph.is_empty():
			out.append({START: start, TEXT: ""})
		var i := 0
		while i < paragraph.length():
			var end := _fitting_end(paragraph, i, width, advance)
			if end >= paragraph.length():
				out.append({START: start + i, TEXT: paragraph.substr(i)})
				break
			var next := end
			if paragraph[end] == SPACE:             # the overflowing spaces hang: the line ends after them
				while next < paragraph.length() and paragraph[next] == SPACE:
					next += 1
			else:
				var opportunity := _last_opportunity(paragraph, i, end)
				next = opportunity if opportunity > i else end
			out.append({START: start + i, TEXT: paragraph.substr(i, next - i)})
			i = next
		start += paragraph.length() + NEWLINE.length()
	return out

## Whether Blink may wrap between `before` and `after` (both single characters, neither a space).
static func can_break(before: String, after: String) -> bool:
	_load()
	var row := _chars.find(before)
	var column := _chars.find(after)
	return row >= 0 and column >= 0 and _rows[row][column] == BREAKABLE

## The index after the last character from `from` that fits `width` (at least one character, however wide).
static func _fitting_end(paragraph: String, from: int, width: float, advance: Callable) -> int:
	var used := 0.0
	var end := from
	while end < paragraph.length():
		var step: float = advance.call(paragraph[end])
		if used + step > width + FIT_EPS and end > from:
			break
		used += step
		end += 1
	return end

## The last break position in (from, end]: after a space before a non-space, or a breakable pair; -1 without one.
static func _last_opportunity(paragraph: String, from: int, end: int) -> int:
	for position in range(end, from, -1):
		var before := paragraph[position - 1]
		var after := paragraph[position]
		if (before == SPACE and after != SPACE) or can_break(before, after):
			return position
	return -1

static func _load() -> void:
	if not _chars.is_empty():
		return
	var table: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(TABLE_PATH))
	_chars = table["chars"]
	_rows = PackedStringArray(table["rows"])
