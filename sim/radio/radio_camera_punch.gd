class_name RadioCameraPunch extends RefCounted
## The Radio takeover's camera — port of web RadioTakeover RadioCameraMod: a beat SETS a zoom target (a small floor plus
## its strength), which deflates slowly while the zoom chases it fast — overlapping beats re-arm it instead of running
## it away — and a faint shake by the beat's strength decays quickly. Applied after the menu camera rig, before the frame
## renders.

const PUNCH_BASE := 0.05                        # web RADIO_CAM_PUNCH_BASE (world units along the view)
const PUNCH_STRENGTH := 0.32                    # web RADIO_CAM_PUNCH_STRENGTH
const ATTACK_TAU := 0.045                       # web RADIO_CAM_ATTACK_TAU
const DECAY_TAU := 0.22                         # web RADIO_CAM_DECAY_TAU
const SHAKE_AMP := 0.006                        # web RADIO_CAM_SHAKE_AMP
const SHAKE_DECAY_TAU := 0.08                   # web RADIO_CAM_SHAKE_DECAY_TAU
const MAX_DT := 0.1
const HALF := 0.5

var punch := 0.0                                # the zoom this frame
var shake := 0.0                                # the jitter amplitude this frame

var _target := 0.0

func step(dt: float, beat_fired: bool, beat_strength: float) -> void:
	var clamped := minf(dt, MAX_DT)
	if beat_fired:
		_target = PUNCH_BASE + PUNCH_STRENGTH * beat_strength
		shake = SHAKE_AMP * beat_strength
	_target += (0.0 - _target) * (1.0 - exp(-clamped / DECAY_TAU))
	punch += (_target - punch) * (1.0 - exp(-clamped / ATTACK_TAU))
	shake += (0.0 - shake) * (1.0 - exp(-clamped / SHAKE_DECAY_TAU))

## The camera's move this frame: the zoom along `forward`, and each axis jittered within ±shake by `random` (0..1).
func offset(forward: Vector3, random: Callable) -> Vector3:
	var jitter := Vector3.ZERO
	if shake > 0.0:
		jitter = Vector3((float(random.call()) - HALF) * 2.0 * shake, (float(random.call()) - HALF) * 2.0 * shake,
			(float(random.call()) - HALF) * 2.0 * shake)
	return forward * punch + jitter

func target() -> float:
	return _target
