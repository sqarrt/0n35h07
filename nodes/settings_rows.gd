class_name SettingsRows
## The row metrics web components/SettingsControls shares with screens/Settings — a row's 0.6rem gap and 1.6rem margin,
## the slider block's 1.4rem margin, a ToggleRow's 0.9rem gap — and their placement: boxes at fractional CSS positions
## painted from whole pixels like Chrome.

const ROW_GAP := 9.6                           # row: gap 0.6rem
const ROW_MARGIN_BOTTOM := 25.6                # row: marginBottom 1.6rem (and the 1.6rem field blocks)
const SLIDER_MARGIN_BOTTOM := 22.4             # Slider: marginBottom 1.4rem
const TOGGLE_GAP := 14.4                       # ToggleRow gap 0.9rem
const HALF := 0.5

## A box at a fractional CSS position, painted from whole pixels.
static func place(control: Control, x: float, y: float, box: Vector2) -> void:
	control.position = Vector2(CssPixel.snap(x), CssPixel.snap(y))
	control.size = box
	CssOffset.keep(control, x)

## A sub-header across the column; returns the top of what follows its margin.
static func header(label: Label, top: float, width: float) -> float:
	var height := label.get_combined_minimum_size().y
	place(label, 0.0, top, Vector2(width, height))
	return top + height + MenuText.SUB_HEADER_MARGIN_BOTTOM

## A ToggleRow: the switch, then its caption centred on the row (align-items: center); returns the next row's top.
static func toggle_row(toggle: UiToggle, caption: Label, top: float) -> float:
	place(toggle, 0.0, top, UiToggle.BOX_SIZE)
	var caption_box := caption.get_combined_minimum_size()
	place(caption, UiToggle.BOX_SIZE.x + TOGGLE_GAP, top + (UiToggle.BOX_SIZE.y - caption_box.y) * HALF, caption_box)
	return top + UiToggle.BOX_SIZE.y + ROW_MARGIN_BOTTOM
