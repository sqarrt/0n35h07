class_name CssShadow
## CSS shadow maths for the glow nodes (text-shadow, box-shadow, drop-shadow): a blur radius B is a Gaussian with
## standard deviation B / 2 (css-backgrounds-3, as Chromium draws it), sampled out to 3 sigma. A shadow is
## {"blur": px, "color": Color, "offset": Vector2}; in a list the first shadow paints on top.

const BLUR_TO_SIGMA := 0.5
const KERNEL_SIGMAS := 3.0
const TRANSPARENT := Color(0.0, 0.0, 0.0, 0.0)

static func make(blur_px: float, color: Color, offset := Vector2.ZERO) -> Dictionary:
	return {"blur": blur_px, "color": color, "offset": offset}

static func sigma(blur_px: float) -> float:
	return blur_px * BLUR_TO_SIGMA

## How far past the glyphs a shadow can paint, whole pixels.
static func reach_px(shadow: Dictionary) -> int:
	var offset: Vector2 = shadow["offset"]
	return ceili(sigma(shadow["blur"]) * KERNEL_SIGMAS) + ceili(maxf(absf(offset.x), absf(offset.y)))

## Room a list of shadows needs around the glyphs.
static func padding(shadows: Array) -> int:
	var pad := 0
	for shadow in shadows:
		pad = maxi(pad, reach_px(shadow))
	return pad

## CSS colour interpolation in premultiplied alpha: fading towards transparent keeps the hue.
static func lerp_color(from: Color, to: Color, t: float) -> Color:
	var alpha := lerpf(from.a, to.a, t)
	if alpha <= 0.0:
		return TRANSPARENT
	var weight_from := from.a * (1.0 - t)
	var weight_to := to.a * t
	return Color((from.r * weight_from + to.r * weight_to) / alpha, (from.g * weight_from + to.g * weight_to) / alpha,
		(from.b * weight_from + to.b * weight_to) / alpha, alpha)

## CSS shadow-list interpolation: the shorter list is padded with transparent 0 px shadows.
static func lerp_lists(from: Array, to: Array, t: float) -> Array:
	var out := []
	for i in maxi(from.size(), to.size()):
		var a: Dictionary = from[i] if i < from.size() else make(0.0, TRANSPARENT)
		var b: Dictionary = to[i] if i < to.size() else make(0.0, TRANSPARENT)
		out.append(make(lerpf(a["blur"], b["blur"], t), lerp_color(a["color"], b["color"], t),
			(a["offset"] as Vector2).lerp(b["offset"], t)))
	return out
