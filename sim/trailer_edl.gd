class_name TrailerEdl
## The trailer's storyboard — port of web components/trailer/trailerEdl.ts: the shots in order — a countdown over
## emptiness, text cuts, play shots (one clip's short fragments back to back, jump cuts; a new clip is a new shot behind
## the cover) and the finale. Frame indices are the recordings' (30 fps: 1.5 s ≈ 45 frames).

const COUNTDOWN := "countdown"
const TEXT := "text"
const PLAY := "play"
const FINALE := "finale"
const CUT_MS := 900.0                          # web CUT_MS
const COUNTDOWN_MS := 3200.0
const SHOTS := [
	{"type": COUNTDOWN, "clip": "os_arena", "frame": 90, "duration_ms": COUNTDOWN_MS},
	{"type": TEXT, "text": "READ YOUR OPPONENT", "duration_ms": CUT_MS},
	{"type": PLAY, "clip": "os_arena", "ranges": [[160, 196], [308, 345], [745, 788], [250, 285]]},
	{"type": TEXT, "text": "ONE SHOT, ONE KILL", "duration_ms": CUT_MS},
	{"type": PLAY, "clip": "os_india", "ranges": [[145, 185], [295, 330], [1270, 1300], [1983, 2018]]},
	{"type": TEXT, "text": "OUTPLAY THEM", "duration_ms": CUT_MS},
	{"type": PLAY, "clip": "os_pillars", "ranges": [[95, 135], [720, 765], [933, 970], [800, 835]]},
	{"type": TEXT, "text": "MAKE IT YOURS", "duration_ms": CUT_MS},
	{"type": PLAY, "clip": "os_arena", "ranges": [[1015, 1048], [1165, 1200]]},
	{"type": PLAY, "clip": "os_india", "ranges": [[488, 522], [1028, 1062]]},
	{"type": PLAY, "clip": "os_pillars", "ranges": [[1873, 1905]]},
	{"type": FINALE},
]

## The clips the play shots use, each once.
static func clips() -> Array:
	var ids := []
	for shot in SHOTS:
		if shot["type"] == PLAY and not ids.has(shot["clip"]):
			ids.append(shot["clip"])
	return ids

## web FIRST_TEXT_INDEX: the first cut gets no GO sound.
static func first_text_index() -> int:
	for i in SHOTS.size():
		if SHOTS[i]["type"] == TEXT:
			return i
	return -1
