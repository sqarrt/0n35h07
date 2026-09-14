class_name MenuGlowLevel extends RefCounted
## The menu edge glow's brightness — port of web MenuEdgeGlow's useFrame: the glow composer mounts MOUNT_DELAY_MS after
## the backdrop (web GLOW_MOUNT_DELAY_MS), then each frame the audio level on a perceptual √ curve (LEVEL_GAIN, capped
## at 1; 0 while muted) is approached by GLOW_SMOOTH of the way, and the edge intensity is that times INTENSITY_GAIN.

const MOUNT_DELAY_MS := 600.0       # web GLOW_MOUNT_DELAY_MS
const LEVEL_GAIN := 3.2             # web LEVEL_GAIN
const GLOW_SMOOTH := 0.18           # web GLOW_SMOOTH (per frame, as the web applies it)
const INTENSITY_BASE := 0.0         # web INTENSITY_BASE: silence has no glow at all
const INTENSITY_GAIN := 1.1         # web INTENSITY_GAIN
const LIT_EPS := 0.00001            # below this the glow adds nothing visible: the post chain can rest
const MS_PER_S := 1000.0

var _age_ms := 0.0
var _level := 0.0

## One frame: `audio_level` 0..1 (AudioAnalysisHub.level), `muted` when the profile's menu glow is off.
func step(dt: float, audio_level: float, muted: bool) -> void:
	if _age_ms < MOUNT_DELAY_MS:
		_age_ms += dt * MS_PER_S
		return
	var target := 0.0 if muted else minf(1.0, sqrt(maxf(audio_level, 0.0) * LEVEL_GAIN))
	_level += (target - _level) * GLOW_SMOOTH

func intensity() -> float:
	return INTENSITY_BASE + _level * INTENSITY_GAIN

func is_lit() -> bool:
	return intensity() > LIT_EPS
