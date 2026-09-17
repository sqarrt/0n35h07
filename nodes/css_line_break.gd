class_name CssLineBreak
## Chrome's greedy line breaking for a paragraph (`white-space: normal`): a line may end after a space or between two
## CJK characters (never before closing CJK punctuation); it takes every run that still fits the width, measured without
## its trailing spaces. A run wider than the width stays whole on its own line.

const SPACE := " "
const CJK_RANGES := [[0x2E80, 0x9FFF], [0xF900, 0xFAFF], [0xFF00, 0xFFEF]]
const NO_BREAK_BEFORE := "，。、；：！？）」』》〉…·"

## The paragraph's lines. `measure` returns a string's CSS width.
static func lines(text: String, width: float, measure: Callable) -> PackedStringArray:
	var result := PackedStringArray()
	var current := ""
	for run in runs(text):
		var candidate := current + run
		if current != "" and float(measure.call(candidate.strip_edges(false, true))) > width:
			result.append(current.strip_edges(false, true))
			current = run
		else:
			current = candidate
	if current.strip_edges() != "":
		result.append(current.strip_edges(false, true))
	return result

## The text cut at its break opportunities, each run keeping the spaces after it.
static func runs(text: String) -> PackedStringArray:
	var result := PackedStringArray()
	var run := ""
	for i in text.length():
		var c := text[i]
		run += c
		var next := text[i + 1] if i + 1 < text.length() else ""
		var after_space := c == SPACE and next != SPACE
		var between_cjk := next != "" and (is_cjk(c) or is_cjk(next)) and c != SPACE and next != SPACE \
			and not NO_BREAK_BEFORE.contains(next)
		if after_space or between_cjk:
			result.append(run)
			run = ""
	if run != "":
		result.append(run)
	return result

static func is_cjk(c: String) -> bool:
	var code := c.unicode_at(0)
	for span in CJK_RANGES:
		if code >= span[0] and code <= span[1]:
			return true
	return false
