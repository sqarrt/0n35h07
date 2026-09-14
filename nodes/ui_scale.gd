class_name UiScale
## The desktop WebView's device pixel ratio. The Steam build's WebView lays the page out in CSS px — the display's pixels
## over the Windows scale, which Windows reports as DPI / 96 — and draws its canvases at that ratio. The port keeps the
## same logical units through the root window's content scale; render targets and screen-space shader sizes that must
## stay sharp or keep their reach use device pixels.

const REFERENCE_DPI := 96.0
const MIN_SCALE := 1.0

static func for_dpi(dpi: int) -> float:
	return maxf(MIN_SCALE, dpi / REFERENCE_DPI)

## The scale an item is drawn at: its viewport's final (content scale) transform — 1 inside a SubViewport or outside the
## tree.
static func of(item: CanvasItem) -> float:
	if not item.is_inside_tree():
		return MIN_SCALE
	return item.get_viewport().get_final_transform().get_scale().x

## A render target's size in device pixels for a logical size, rounded up, never empty.
static func device_size(logical: Vector2, scale: float) -> Vector2i:
	return Vector2i((logical * scale).ceil()).max(Vector2i.ONE)
