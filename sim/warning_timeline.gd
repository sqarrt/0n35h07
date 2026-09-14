class_name WarningTimeline
## The photosensitivity warning's clock — port of web EpilepsyWarning and theme.css `.warn-*`: the content fades in
## over 320 ms, the hint (and the click that closes the screen) waits 1500 ms for the menu to warm up and fades in over
## 240 ms, the planet breathes with warn-bg-pulse, and a click fades the whole screen out over 280 ms before it goes.

const CONTENT_IN_MS := 320.0                   # warn-content-in 320ms ease
const HINT_DELAY_MS := 1500.0                  # HINT_DELAY_MS
const HINT_FADE_MS := 240.0                    # .warn-hint transition: opacity 240ms ease
const FADE_OUT_MS := 280.0                     # WARN_FADE_MS / .warn-screen transition 280ms ease
const PULSE_PERIOD_S := 4.0                    # warn-bg-pulse 4s ease-in-out infinite
const PULSE_KEYS := [[0.0, 0.13], [0.5, 0.24], [1.0, 0.13]]
const MS_PER_S := 1000.0

static func content_opacity(ms: float) -> float:
	return CssTiming.cubic_bezier(ms / CONTENT_IN_MS, CssTiming.EASE)

## web handleDismiss: clicks before the hint are ignored.
static func can_dismiss(ms: float) -> bool:
	return ms >= HINT_DELAY_MS

static func hint_opacity(ms: float) -> float:
	if not can_dismiss(ms):
		return 0.0
	return CssTiming.cubic_bezier((ms - HINT_DELAY_MS) / HINT_FADE_MS, CssTiming.EASE)

## The planet's layer opacity `ms` into warn-bg-pulse.
static func planet_opacity(ms: float) -> float:
	return CssTiming.sample(PULSE_KEYS, CssTiming.cycle_fraction(ms / MS_PER_S, PULSE_PERIOD_S), CssTiming.EASE_IN_OUT)

## The whole screen `ms` after the dismissing click.
static func screen_opacity(ms: float) -> float:
	return 1.0 - CssTiming.cubic_bezier(ms / FADE_OUT_MS, CssTiming.EASE)

static func is_gone(ms: float) -> bool:
	return ms >= FADE_OUT_MS
