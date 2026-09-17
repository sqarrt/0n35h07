class_name SkinCurves
## Ball animation curves of the windup / respawn skins — ports of web ClassicWindupFx, RageWindupFx and
## SingularityWindupFx (the ball part) and EchoRespawnFx, plus the shared skin constants (constants.ts). Colours mix
## in linear space like three.js. Pure maths; the ball visual applies it.

const BODY_MESH_Y := -0.3              # web BODY_MESH_Y: ball centre below the eye
const WINDUP_SCALE_GAIN := 0.4
const WINDUP_SHRINK_MS := 200.0
const RAGE_SCALE_GAIN := 0.25
const RAGE_BODY_DARK := Color("#1a0505")
const RAGE_EMISSIVE := Color("#ff2200")
const RAGE_PULSE_HZ_MIN := 1.5
const RAGE_PULSE_HZ_MAX := 6.0
const RAGE_PULSE_DEPTH := 0.45
const SING_SHRINK := 0.35
const SING_DARK := Color("#05050d")
const GHOST_OPACITY := 0.4
const SPAWN_ANIM_MS := 280.0
const SPAWN_POP := 0.25
const DASH_TRAIL_COUNT := 10
const DASH_TRAIL_RADIUS := 0.5
const DASH_TRAIL_INTERVAL_MS := 16.0
const DASH_TRAIL_LIFE_MS := 260.0
const DASH_TRAIL_OPACITY := 0.4
const DEATH_BURST_COUNT := 14
const DEATH_BURST_RADIUS := 0.16
const DEATH_BURST_LIFE_MS := 400.0
const DEATH_BURST_SPEED := 6.0
const DEATH_BURST_OPACITY := 0.9
const STYLE_RAGE := "rage"
const STYLE_SINGULARITY := "singularity"
const HALF := 0.5
const MS_PER_S := 1000.0

## Deflate progress after a shot (0 at the shot, 1 when done or never fired).
static func shrink(since_fire_ms: float) -> float:
	return minf(since_fire_ms / WINDUP_SHRINK_MS, 1.0)

## three.js Color.lerpColors on linear colours, returned as sRGB.
static func lerp_linear(from: Color, to: Color, t: float) -> Color:
	return from.srgb_to_linear().lerp(to.srgb_to_linear(), t).linear_to_srgb()

## The ball under a windup style: {"scale", "color" (sRGB), "emission" (linear)}.
static func windup_ball(style: String, progress: float, shrink_k: float, base: Color, time_s: float) -> Dictionary:
	match style:
		STYLE_RAGE:
			if progress > 0.0:
				var hz := RAGE_PULSE_HZ_MIN + (RAGE_PULSE_HZ_MAX - RAGE_PULSE_HZ_MIN) * progress
				var pulse := 1.0 - RAGE_PULSE_DEPTH * (HALF + HALF * sin(time_s * hz * TAU))
				return _ball(1.0 + progress * RAGE_SCALE_GAIN, lerp_linear(base, RAGE_BODY_DARK, progress),
					RAGE_EMISSIVE.srgb_to_linear() * (progress * pulse))
			if shrink_k < 1.0:
				return _ball(1.0 + RAGE_SCALE_GAIN * (1.0 - shrink_k), base,
					RAGE_EMISSIVE.srgb_to_linear() * (1.0 - shrink_k))
		STYLE_SINGULARITY:
			if progress > 0.0:
				return _ball(1.0 - SING_SHRINK * progress, lerp_linear(base, SING_DARK, progress), Color.BLACK)
			if shrink_k < 1.0:
				return _ball(1.0 - SING_SHRINK * (1.0 - shrink_k), base, Color.BLACK)
		_:
			if progress > 0.0:
				return _ball(1.0 + progress * WINDUP_SCALE_GAIN, lerp_linear(base, Color.WHITE, progress), Color.BLACK)
			if shrink_k < 1.0:
				return _ball(1.0 + WINDUP_SCALE_GAIN * (1.0 - shrink_k), base, Color.BLACK)
	return _ball(1.0, base, Color.BLACK)

## Echo respawn on the ball: {"active", "scale", "opacity"}; inactive frames leave the ball to the windup.
static func echo_respawn(ghost: bool, since_rebirth_ms: float) -> Dictionary:
	if ghost:
		return {"active": true, "scale": 1.0, "opacity": GHOST_OPACITY}
	if is_echo_rebirth(since_rebirth_ms):
		var st := since_rebirth_ms / SPAWN_ANIM_MS
		return {"active": true, "scale": 1.0 + SPAWN_POP * sin(PI * st), "opacity": 1.0}
	return {"active": false, "scale": 1.0, "opacity": 1.0}

static func is_echo_rebirth(since_rebirth_ms: float) -> bool:
	return since_rebirth_ms >= 0.0 and since_rebirth_ms < SPAWN_ANIM_MS

static func _ball(scale_factor: float, color: Color, emission: Color) -> Dictionary:
	return {"scale": scale_factor, "color": color, "emission": emission}
