class_name MusicScheduler extends RefCounted
## The music engine's loop clock — web WebAudioMusicEngine's lookahead scheduler for bar-quantised playback: the
## arrangement of loop k + 1 is requested SCHEDULE_AHEAD_SEC before its boundary (Godot's next-bar transition then
## lands on that boundary) and its levels, pans and sends are applied when the boundary passes. After a stall the clock
## jumps to the present loop instead of replaying the missed ones (web tick).
## Actions: {"t": "request" | "apply" | "skip", "loop": int}.

const LOOP_SECONDS := 8.0
const SCHEDULE_AHEAD_SEC := 2.0
const REQUEST := "request"
const APPLY := "apply"
const SKIP := "skip"

var _requested := 0                   # loop 0 is set up before playback starts
var _applied := 0

func requested_loop() -> int:
	return _requested

func applied_loop() -> int:
	return _applied

## What to do at `elapsed_s` seconds since playback started.
func actions(elapsed_s: float) -> Array:
	var out := []
	var current := floori(elapsed_s / LOOP_SECONDS)
	if current > _requested:
		_requested = current
		_applied = current
		out.append({"t": SKIP, "loop": current})
	if _applied < _requested and elapsed_s >= _requested * LOOP_SECONDS:
		_applied = _requested
		out.append({"t": APPLY, "loop": _applied})
	var next := _requested + 1
	if _applied == _requested and elapsed_s >= next * LOOP_SECONDS - SCHEDULE_AHEAD_SEC:
		_requested = next
		out.append({"t": REQUEST, "loop": next})
	return out
