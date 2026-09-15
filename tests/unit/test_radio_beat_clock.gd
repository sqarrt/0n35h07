extends GutTest
## RadioBeatClock — web RadioTakeover BeatClock: steady kicks at the tempo fire beats locked to the grid with strength
## by loudness; a drone (no rise) never fires; kicks closer than the refractory gap fire once; an off-grid transient
## is rejected.

const EPS := 0.001
const BPM := 120.0
const FRAME_S := 1.0 / 60.0
const KICK := 0.35
const INTERVAL_FRAMES := 30                     # 0.5 s at 120 bpm

func _bands(kick: float) -> PackedFloat32Array:
	return PackedFloat32Array([kick, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0])

## Frames of silence with a one-frame kick every `every` frames; how many beats fired.
func _run(clock: RadioBeatClock, frames: int, every: int, level := KICK, offset := 0) -> int:
	var beats := 0
	for frame in frames:
		var on := (frame + offset) % every == 0
		clock.step(FRAME_S, _bands(level if on else 0.0), BPM)
		if clock.fired:
			beats += 1
	return beats

func test_kicks_on_the_tempo_fire_beats_with_their_loudness() -> void:
	var clock := RadioBeatClock.new()
	var beats := _run(clock, INTERVAL_FRAMES * 8, INTERVAL_FRAMES)
	assert_gte(beats, 7, "a beat per kick once the grid meets them")
	var soft := RadioBeatClock.new()
	for frame in INTERVAL_FRAMES * 4:
		soft.step(FRAME_S, _bands(0.07 if frame % INTERVAL_FRAMES == 0 else 0.0), BPM)
		if soft.fired:
			assert_almost_eq(soft.strength, 0.07 / RadioBeatClock.FLUX_FULL, EPS, "strength ∝ the kick's rise")

func test_a_drone_never_fires() -> void:
	var clock := RadioBeatClock.new()
	var beats := 0
	for frame in INTERVAL_FRAMES * 8:
		clock.step(FRAME_S, _bands(0.8), BPM)
		beats += 1 if clock.fired else 0
	assert_lte(beats, 1, "only the first rise from silence; a held level has no flux")

func test_kicks_inside_the_refractory_gap_fire_once() -> void:
	var clock := RadioBeatClock.new()
	_run(clock, INTERVAL_FRAMES * 4, INTERVAL_FRAMES)      # lock onto the grid
	var beats := _run(clock, INTERVAL_FRAMES, 4)            # a kick every 4 frames: far closer than 40% of 0.5 s
	assert_lte(beats, 2)

func test_the_phase_wraps_within_an_interval() -> void:
	var clock := RadioBeatClock.new()
	for frame in 100:
		clock.step(FRAME_S, _bands(0.0), BPM)
	assert_between(clock.phase(), 0.0, 0.5)

func test_a_long_frame_counts_as_a_tenth_of_a_second() -> void:
	var clock := RadioBeatClock.new()
	clock.step(1.0, _bands(0.0), BPM)
	assert_almost_eq(clock.phase(), RadioBeatClock.MAX_DT, EPS)
