class_name RadioSoftBloom extends RefCounted
## The Radio screen's frosted-glass bloom — web MenuEdgeGlow softBloom: the menu's one bloom morphs toward threshold 0
## (the whole scene blooms) and a 0.95 radius over ~0.2 s, its intensity SOFT_BASE in silence rising with the audio
## level (√(level × 1.6), approached 0.18 of the way per frame, × 1.4); the model edges glow 1.8 times brighter while it
## is on. The composer mounts MenuGlowLevel.MOUNT_DELAY_MS after the backdrop, like the edge glow.

const THRESHOLD := 0.0                          # web SOFT_THRESHOLD: bloom everything
const RADIUS := 0.95                            # web SOFT_RADIUS
const BASE := 0.35                              # web SOFT_BASE: hazy even in silence
const GAIN := 1.4                               # web SOFT_GAIN
const LEVEL_GAIN := 1.6                         # web SOFT_LEVEL_GAIN
const LEVEL_SMOOTH := 0.18                      # web SOFT_LEVEL_SMOOTH (per frame)
const FADE_TAU := 0.06                          # web SOFT_FADE_TAU
const EDGE_BOOST := 1.8                         # web RADIO_EDGE_BOOST
const MAX_DT := 0.1                             # web Math.min(dtRaw, 0.1)
const VISIBLE_EPS := 0.00001
const MS_PER_S := 1000.0

var _age_ms := 0.0
var _fade := 0.0
var _level := 0.0

## One frame: `audio_level` 0..1, `on` while the Radio screen is up.
func step(dt: float, audio_level: float, on: bool) -> void:
	if _age_ms < MenuGlowLevel.MOUNT_DELAY_MS:
		_age_ms += dt * MS_PER_S
		return
	_fade += ((1.0 if on else 0.0) - _fade) * (1.0 - exp(-minf(dt, MAX_DT) / FADE_TAU))
	_level += (minf(1.0, sqrt(maxf(audio_level, 0.0) * LEVEL_GAIN)) - _level) * LEVEL_SMOOTH

## How far the bloom has morphed to the frosted look, 0..1.
func fade() -> float:
	return _fade

func threshold() -> float:
	return lerpf(MenuEdgeGlow.BLOOM_THRESHOLD, THRESHOLD, _fade)

func radius() -> float:
	return lerpf(MenuEdgeGlow.BLOOM_RADIUS, RADIUS, _fade)

func intensity() -> float:
	return lerpf(MenuEdgeGlow.BLOOM_INTENSITY, BASE + GAIN * _level, _fade)

## The frosted bloom shows something (the post chain must render even without an edge glow).
func is_visible() -> bool:
	return _fade > VISIBLE_EPS

## web: the edge intensity × RADIO_EDGE_BOOST while the Radio screen is up (not faded).
static func edge_boost(on: bool) -> float:
	return EDGE_BOOST if on else 1.0
