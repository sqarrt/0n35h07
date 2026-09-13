class_name AudioBarModel extends RefCounted
## The HUD sound visualiser line — port of web components/AudioBar.tsx: 40 log bands gained x1.4 with a fast attack
## and a slow decay, drawn as one symmetric polyline (bass at the centre, highs toward both ends) inside a
## 1200 x 90 viewBox stretched over the container.

const BANDS := 40
const BAR_GAIN := 1.4
const SMOOTH_UP := 0.55
const SMOOTH_DOWN := 0.14
const VIEWBOX_W := 1200.0
const VIEWBOX_H := 90.0
const AMP := 78.0
const WIDTH_SHARE := 0.46                # 46% of the screen width
const HEIGHT_PX := 42.0
const BOTTOM_OFFSET_PX := 14.0           # above the bottom frame inset
const BOTTOM_PX := HudModel.FRAME_INSET + BOTTOM_OFFSET_PX
const STROKE_PX := 2.5
const GLOW_SIGMA_PX := 4.0               # filter: drop-shadow(0 0 4px) -> Chrome sigma 4
const COLOR := Color("#4af")

var _current := PackedFloat32Array()

func _init() -> void:
	_current.resize(BANDS)

func values() -> PackedFloat32Array:
	return _current

## One animation frame with fresh band levels (0..1).
func step(raw: PackedFloat32Array) -> void:
	for i in BANDS:
		var target := minf(1.0, raw[i] * BAR_GAIN)
		_current[i] += (target - _current[i]) * (SMOOTH_UP if target > _current[i] else SMOOTH_DOWN)

## The line in container pixels (the viewBox is stretched without keeping its aspect).
func points(container: Vector2) -> PackedVector2Array:
	var count := BANDS * 2 - 1
	var center := BANDS - 1
	var out := PackedVector2Array()
	out.resize(count)
	for k in count:
		var v := _current[absi(k - center)]
		out[k] = Vector2(float(k) / (count - 1) * container.x, (VIEWBOX_H - 1.0 - v * AMP) / VIEWBOX_H * container.y)
	return out
