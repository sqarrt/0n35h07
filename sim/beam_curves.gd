class_name BeamCurves
## Beam skin timing and layout — ports of web ClassicBeamFx (radial shrink over the beam life, fading afterglow),
## RageBeamFx (white core + seven rattling player-coloured segments, thickness pulse, stepped fade) and
## SingularityBeamFx (dark thread + faint shell + a particle spiral retracting into the muzzle). Pure maths.

const CYL_SEGMENTS_CLASSIC := 8
const CYL_SEGMENTS_STYLED := 6
const CORE_RADIUS := 0.05
const SHELL_RADIUS := 0.15
const SHELL_OPACITY := 0.6
const AFTERGLOW_RADIUS := 0.1
const AFTERGLOW_INITIAL := 0.5
const AFTERGLOW_FADE := 1.8
const AFTERGLOW_OPACITY_K := 0.4
const RAGE_SEGMENTS := 7
const RAGE_CORE_RADIUS := 0.04
const RAGE_SEG_RADIUS := 0.16
const RAGE_SEG_OPACITY := 0.7
const RAGE_SEG_LEN_FRAC := 0.8
const RAGE_JITTER_MAX := 0.22
const RAGE_JITTER_INTERVAL_MS := 90.0
const RAGE_PULSE_HZ := 9.0
const RAGE_PULSE_DEPTH := 0.2
const RAGE_FADE_STEPS := [[0.45, 1.0], [0.6, 0.35], [0.75, 0.8], [0.9, 0.25], [1.0, 0.1]]   # [until, level]
const SING_CORE_RADIUS := 0.03
const SING_CORE_COLOR := Color("#05050d")
const SING_CORE_OPACITY := 0.95
const SING_SHELL_RADIUS := 0.09
const SING_SHELL_OPACITY := 0.25
const SING_SPIRAL_PARTICLES := 64
const SING_SPIRAL_RADIUS := 0.35
const SING_SPIRAL_SHRINK := 0.6
const SING_TURNS_PER_UNIT := 0.7
const SING_PHASE_SPEED := 2.5
const SING_SPIRAL_SIZE := 0.07
const SING_SPIRAL_OPACITY := 0.9
const SING_RETRACT_START := 0.35
const BOT_SHELL_COLOR := Color("#f44")   # web Match: bots fire a classic beam with a red "enemy" shell
const HALF := 0.5
const MIN_AXIS_SQ := 1e-8

static func classic_width(t: float) -> float:
	return 1.0 - t

static func afterglow_step(energy: float, dt: float) -> float:
	return energy - dt * AFTERGLOW_FADE

static func afterglow_opacity(energy: float) -> float:
	return energy * AFTERGLOW_OPACITY_K

static func rage_level(t: float) -> float:
	for step in RAGE_FADE_STEPS:
		if t < step[0]:
			return step[1]
	return RAGE_FADE_STEPS[RAGE_FADE_STEPS.size() - 1][1]

static func rage_pulse(time_s: float) -> float:
	return 1.0 + RAGE_PULSE_DEPTH * sin(time_s * RAGE_PULSE_HZ * TAU)

static func rage_segment_center(start: Vector3, end: Vector3, index: int) -> Vector3:
	return start.lerp(end, (index + HALF) / RAGE_SEGMENTS)

static func rage_segment_length(beam_length: float) -> float:
	return beam_length / RAGE_SEGMENTS * RAGE_SEG_LEN_FRAC

static func singularity_retract(t: float) -> float:
	return 0.0 if t <= SING_RETRACT_START else (t - SING_RETRACT_START) / (1.0 - SING_RETRACT_START)

static func spiral_radius(t: float) -> float:
	return SING_SPIRAL_RADIUS * (1.0 - SING_SPIRAL_SHRINK * t)

## Lateral basis of a beam direction: [dir × UP (X for a vertical beam), dir × side1].
static func side_axes(direction: Vector3) -> Array:
	var side1 := direction.cross(Vector3.UP)
	if side1.length_squared() < MIN_AXIS_SQ:
		side1 = Vector3.RIGHT
	side1 = side1.normalized()
	return [side1, direction.cross(side1).normalized()]

## Spiral particle `index` of SING_SPIRAL_PARTICLES: coiled along the visible length, phase running muzzle -> target.
static func spiral_point(index: int, phase: float, visible_length: float, radius: float, start: Vector3,
		direction: Vector3, side1: Vector3, side2: Vector3) -> Vector3:
	var along := fposmod(float(index) / SING_SPIRAL_PARTICLES + phase, 1.0) * visible_length
	var angle := along * SING_TURNS_PER_UNIT * TAU
	return start + direction * along + side1 * cos(angle) * radius + side2 * sin(angle) * radius
