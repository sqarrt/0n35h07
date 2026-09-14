class_name CssDashedBorder
## Chrome's `border-style: dashed`, as measured on the web lobby seats: dashes three border widths long with gaps of
## about two, their count fitted to each side's straight run (inside the rounded corners) so the gaps come out equal
## and the run is centred on the side.

const DASH_WIDTHS := 3.0                 # dash length / border width
const GAP_WIDTHS := 2.0                  # nominal gap / border width
const CORNER_INSET_WIDTHS := 1.0         # the run starts this many widths before the corner radius ends
const MIN_DASHES := 1
const HALF := 0.5

## The dashes along one side of `length` px: [start, end] offsets from the side's start.
static func dashes(length: float, width: float, radius: float) -> Array[Vector2]:
	var dash := DASH_WIDTHS * width
	var inset := maxf(radius - CORNER_INSET_WIDTHS * width, 0.0)
	var run := maxf(length - 2.0 * inset, dash)
	var count := maxi(roundi((run + GAP_WIDTHS * width) / (dash + GAP_WIDTHS * width)), MIN_DASHES)
	var gap := (run - count * dash) / (count - 1) if count > 1 else 0.0
	var start := inset if count > 1 else (length - dash) * HALF
	var out: Array[Vector2] = []
	for i in count:
		var from := start + i * (dash + gap)
		out.append(Vector2(from, from + dash))
	return out
