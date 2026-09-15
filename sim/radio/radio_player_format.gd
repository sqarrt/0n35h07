class_name RadioPlayerFormat
## The Radio player's pure helpers — port of web components/radioPlayerFmt.ts: a pointer's place along the scrub rail
## as a 0..1 fraction, and a duration as "m:ss".

const MS_PER_SEC := 1000
const SEC_PER_MIN := 60
const TIME_FORMAT := "%d:%02d"
const ZERO_TIME := "0:00"

## Pointer x → fraction 0..1 along a rail starting at `left`, `width` wide (a zero-width rail gives 0).
static func fraction_from_pointer(x: float, left: float, width: float) -> float:
	if width <= 0.0:
		return 0.0
	return clampf((x - left) / width, 0.0, 1.0)

## Milliseconds → "m:ss" (negative or NaN → "0:00").
static func fmt_ms(ms: float) -> String:
	if not (ms > 0.0):
		return ZERO_TIME
	var total := floori(ms / MS_PER_SEC)
	return TIME_FORMAT % [total / SEC_PER_MIN, total % SEC_PER_MIN]
