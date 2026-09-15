extends GutTest
## RadioVizState — web RadioVisualizer draw(): band smoothing, bass / mid / high, the envelope and impulse, the phase,
## AUTO's rotation every 1080 frames, and a pinned frame with its seeded, still field.

const EPS := 0.0001
const SILENT_FRAMES := 60
const PIN := {"phase": 1.7, "frame": 0, "level": 0.08, "impulse": 0.35, "seed": 7,
	"bands": [0.82, 0.9, 0.76, 0.7, 0.62, 0.58, 0.5, 0.46, 0.52, 0.44, 0.4, 0.38, 0.35, 0.3, 0.28, 0.26, 0.3, 0.22, 0.2,
		0.18, 0.15, 0.12, 0.1, 0.08]}

func _bass_hit() -> PackedFloat32Array:
	var bands := PackedFloat32Array()
	bands.resize(RadioVizState.BANDS)
	for i in RadioVizState.BASS_END:
		bands[i] = 1.0
	return bands

func test_a_bass_hit_attacks_and_kicks_the_impulse() -> void:
	var state := RadioVizState.new(func() -> float: return 0.5)
	state.step(_bass_hit(), 0.1)
	assert_almost_eq(state.smooth[0], 0.85, EPS, "attack 0.85")
	assert_almost_eq(state.bass, 0.85, EPS)
	assert_almost_eq(state.mid, 0.0, EPS)
	assert_almost_eq(state.impulse, 1.0, EPS, "(0.85 − the 0.2975 envelope) × 4.5, capped")
	assert_almost_eq(state.level, 0.04, EPS, "0.4 of the way to 0.1")
	assert_almost_eq(state.phase, 0.006 + 0.85 * 0.03 + 1.0 * 0.07, EPS)

func test_silence_releases_slowly() -> void:
	var state := RadioVizState.new(func() -> float: return 0.5)
	state.step(_bass_hit(), 0.1)
	state.step(PackedFloat32Array(), 0.0)
	assert_almost_eq(state.smooth[0], 0.85 - 0.85 * 0.035, EPS, "release 0.035 when silent")
	assert_almost_eq(state.impulse, 1.0, EPS, "the envelope still trails the bass: the kick holds")
	for i in SILENT_FRAMES:
		state.step(PackedFloat32Array(), 0.0)
	assert_lt(state.impulse, 0.5, "once the bass falls under its envelope the impulse decays 0.84 a frame")

func test_auto_rotates_every_eighteen_seconds_of_frames() -> void:
	var state := RadioVizState.new(func() -> float: return 0.5)
	assert_eq(state.take_mode(RadioVizState.AUTO), "scope")
	state.frame = RadioVizState.ROTATE_FRAMES
	assert_eq(state.take_mode(RadioVizState.AUTO), "bars")
	state.frame = RadioVizState.ROTATE_FRAMES * 4
	assert_eq(state.take_mode(RadioVizState.AUTO), "scope")
	assert_eq(state.take_mode("radial"), "radial")

func test_a_pinned_frame_is_seeded_and_still() -> void:
	var state := RadioVizState.pinned(PIN)
	assert_true(state.still)
	assert_almost_eq(state.px[0], 0.011704753153026104, EPS, "mulberry32(7): x")
	assert_almost_eq(state.py[0], 0.06195825757458806, EPS, "then y")
	assert_almost_eq(state.bass, (0.82 + 0.9 + 0.76 + 0.7 + 0.62 + 0.58) / 6.0, EPS)
	assert_almost_eq(state.phase, 1.7, EPS)
	var x := state.px[5]
	state.drift_field()
	assert_eq(state.px[5], x, "the pinned field holds")
