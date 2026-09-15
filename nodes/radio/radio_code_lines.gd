class_name RadioCodeLines extends Control
## The PROGRAM panel's visible code lines: each wrapped line a CssTextRun (Share Tech Mono 0.72rem spaced 0.02em) at
## its row — the text box top the line top plus Chrome's half-leading, in the 1/64 px layout unit — scrolled up by the
## box's offset. Only the rows inside the box draw. The panel draws it twice: in colour on screen, white in the glow mask.

const CODE_PX := 11.52                          # 0.72rem
const SPACING_EM := 0.02
const LINE_HEIGHT_EM := 1.5
const LAYOUT_UNITS := 64.0                      # Chrome lays boxes out in 1/64 px
const HALF := 0.5

var color := Color.WHITE
var left := 0.0
var top := 0.0

var _lines: Array = []                          # CssPreWrap lines
var _runs := {}                                 # row -> CssTextRun
var _scroll := 0.0

## Chrome's line pitch: 1.5 × the font size, floored to the layout unit (17.265625 px for 17.28).
static func pitch() -> float:
	return floorf(LINE_HEIGHT_EM * CODE_PX * LAYOUT_UNITS) / LAYOUT_UNITS

## The text box's top below the line box's: the half-leading, floored to a pixel (the capture: text at 63 under a
## line at 61; only the pitch keeps the layout unit's fraction).
static func half_leading() -> float:
	var line := roundi(UiFont.ASCENT_EM * CODE_PX) + roundi(UiFont.DESCENT_EM * CODE_PX)
	return floorf((pitch() - line) * HALF)

func show_lines(lines: Array) -> void:
	_lines = lines
	_runs.clear()
	queue_redraw()

func set_scroll(offset: float) -> void:
	_scroll = offset
	queue_redraw()

## Where row `row`'s text box starts (its CssTextRun origin), in this control.
func row_origin(row: int) -> Vector2:
	return Vector2(left, top + row * pitch() + half_leading() - _scroll)

func _draw() -> void:
	if _lines.is_empty():
		return
	var first := maxi(0, floori((_scroll - top) / pitch()))
	var last := mini(_lines.size() - 1, ceili((_scroll - top + size.y) / pitch()))
	for row in range(first, last + 1):
		var text: String = _lines[row][CssPreWrap.TEXT]
		if text.strip_edges().is_empty():
			continue
		if not _runs.has(row):
			_runs[row] = CssTextRun.new(text, CODE_PX, SPACING_EM)
		(_runs[row] as CssTextRun).draw(self, row_origin(row), color)
