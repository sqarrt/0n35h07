class_name TrailerCut
## The trailer's text cut — port of theme.css `.trailer-cut`: the text slams in from the left (skewed, letters wide),
## jolts, holds, jolts again and flies off to the right (@keyframes trailer-cut-text over the cut's duration, the
## red / cyan split shadow flashing on the jolts), while a neon bar sweeps open across the middle and fades
## (@keyframes trailer-cut-bar, 0.45 s). CSS interpolates each property between the keyframes that set it (0% and
## 100% fall back to the element's own style), each segment eased by cubic-bezier(.2, 1, .3, 1).

const CURVE := [0.2, 1.0, 0.3, 1.0]            # animation-timing-function of both animations
const BACKGROUND := Color("#04060c")           # .trailer-cut background
const BAR_S := 0.45                            # trailer-cut-bar 0.45s
const TEXT_PX := 88                            # clamp(2rem, 7.5vw, 5.5rem) at 1280 px: 5.5rem
const TEXT_SPACING_EM := 0.2                   # the text's own letter-spacing after the slam
const CHROMA_OFFSET_PX := 3.0                  # text-shadow 3px 0 rgba(255,0,80,.85), -3px 0 rgba(0,220,255,.85)
const CHROMA_RED := Color(1.0, 0.0, 80.0 / 255.0, 0.85)
const CHROMA_CYAN := Color(0.0, 220.0 / 255.0, 1.0, 0.85)
const GLOW_BLUR := 26.0                        # text-shadow 0 0 26px var(--accent)
const BAR_HEIGHT := 3.0                        # .trailer-cut::before height 3px, box-shadow 0 0 22px
const BAR_GLOW_BLUR := 22.0
const HALF := 0.5
## [fraction, value] per property, as the keyframes set it (a transform list without skewX pads it with 0).
const OPACITY_KEYS := [[0.0, 0.0], [0.13, 1.0], [0.8, 1.0], [1.0, 0.0]]
const OFFSET_KEYS := [[0.0, -70.0], [0.13, 0.0], [0.17, 5.0], [0.22, 0.0], [0.8, 0.0], [0.88, -5.0], [1.0, 70.0]]
const SKEW_KEYS := [[0.0, -20.0], [0.13, 0.0], [0.17, 2.0], [0.22, 0.0], [0.8, 0.0], [0.88, 0.0], [1.0, 14.0]]
const SPACING_KEYS := [[0.0, 0.5], [0.13, TEXT_SPACING_EM], [1.0, TEXT_SPACING_EM]]
## The text-shadow keyframes: the split (red, cyan, glow) or the element's own glow alone.
const SHADOW_FRACTIONS := [0.0, 0.13, 0.22, 0.88, 1.0]
const SHADOW_SPLIT := [false, true, false, true, false]
const BAR_SCALE_KEYS := [[0.0, 0.0], [0.6, 1.0], [1.0, 1.0]]
const BAR_OPACITY_KEYS := [[0.0, 1.0], [0.6, 1.0], [1.0, 0.0]]

## The text at `fraction` of the cut: opacity, offset_x (px), skew (degrees) and spacing (em).
static func text(fraction: float) -> Dictionary:
	return {"opacity": CssTiming.sample(OPACITY_KEYS, fraction, CURVE),
		"offset_x": CssTiming.sample(OFFSET_KEYS, fraction, CURVE),
		"skew": CssTiming.sample(SKEW_KEYS, fraction, CURVE),
		"spacing": CssTiming.sample(SPACING_KEYS, fraction, CURVE)}

## The text's shadows at `fraction` (CssShadow dictionaries, first on top): always three, the glow-only keyframe padded
## with transparent ones the way CSS pairs shadow lists, so the glow layers never rebuild.
static func shadows(fraction: float) -> Array:
	var f := clampf(fraction, 0.0, 1.0)
	for i in range(SHADOW_FRACTIONS.size() - 1):
		var to: float = SHADOW_FRACTIONS[i + 1]
		if f <= to:
			var from: float = SHADOW_FRACTIONS[i]
			var t := CssTiming.cubic_bezier((f - from) / (to - from), CURVE)
			return CssShadow.lerp_lists(_shadow_list(SHADOW_SPLIT[i]), _shadow_list(SHADOW_SPLIT[i + 1]), t)
	return CssShadow.lerp_lists(_shadow_list(false), _shadow_list(true), 0.0)

## CSS `transform: translateX(offset_x) skewX(skew)` about the centre of a box placed at `box_position` (the default
## transform-origin 50% 50%), as the transform of that box's parent-space origin.
static func text_transform(offset_x: float, skew_deg: float, box_position: Vector2, box_size: Vector2) -> Transform2D:
	var shear := tan(deg_to_rad(skew_deg))
	return Transform2D(Vector2.RIGHT, Vector2(shear, 1.0),
		Vector2(box_position.x + offset_x - shear * box_size.y * HALF, box_position.y))

## The bar `elapsed_s` into the cut: scale (of the full width) and opacity.
static func bar(elapsed_s: float) -> Dictionary:
	var fraction := clampf(elapsed_s / BAR_S, 0.0, 1.0)
	return {"scale": CssTiming.sample(BAR_SCALE_KEYS, fraction, CURVE),
		"opacity": CssTiming.sample(BAR_OPACITY_KEYS, fraction, CURVE)}

static func _shadow_list(split: bool) -> Array:
	var glow := CssShadow.make(GLOW_BLUR, UiTokens.ACCENT)
	if not split:
		return [glow]
	return [CssShadow.make(0.0, CHROMA_RED, Vector2(CHROMA_OFFSET_PX, 0.0)),
		CssShadow.make(0.0, CHROMA_CYAN, Vector2(-CHROMA_OFFSET_PX, 0.0)), glow]
