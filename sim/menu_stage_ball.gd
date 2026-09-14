class_name MenuStageBall extends RefCounted
## A ball's appearance on the menu stage — port of web MenuBackdrop StageBall: held invisible while the scene warms up
## (WARMUP_FRAMES; the hold reaches the ball one frame after the counter, as React re-renders), then the opacity eases
## toward 1 (tau FADE_TAU) while the ball un-shrinks over SPAWN_MS from a zero age on its first visible frame; leaving,
## it eases toward 0 and shrinks over EXIT_SHRINK_MS.

const WARMUP_FRAMES := 4                # web WARMUP_FRAMES
const FADE_TAU := 0.13                  # web FADE_TAU
const SPAWN_MS := 125.0                 # web SPAWN_MS
const EXIT_SHRINK_MS := 250.0           # web EXIT_SHRINK_MS
const MIN_SCALE := 0.0001               # web Math.max(0.0001, …): never a zero scale
const MAX_DT := 0.1
const MS_PER_S := 1000.0

var opacity := 0.0
var scale := MIN_SCALE

var _frames := 0
var _spawn_age_ms := -1.0               # -1 while held
var _exit := 0.0

func step(dt: float, exiting: bool) -> void:
	var frame_dt := minf(dt, MAX_DT)
	_frames += 1
	if _frames <= WARMUP_FRAMES:
		opacity = 0.0
		return
	var k := 1.0 - exp(-frame_dt / FADE_TAU)
	opacity += ((0.0 if exiting else 1.0) - opacity) * k
	_spawn_age_ms = 0.0 if _spawn_age_ms < 0.0 else _spawn_age_ms + frame_dt * MS_PER_S
	var spawn := minf(_spawn_age_ms / SPAWN_MS, 1.0)
	_exit = minf(1.0, _exit + frame_dt * MS_PER_S / EXIT_SHRINK_MS) if exiting else 0.0
	scale = maxf(MIN_SCALE, spawn * (1.0 - _exit))
