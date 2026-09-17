class_name MatchAudioCues extends RefCounted
## Match sound cues — web Match.tickPhase / endMatch / dispatchAnnounce audio: a countdown tick each time the
## whole-second count changes to 3, 2 or 1, GO (which also starts the match music) on the first live frame, the end cue
## once when the match ends, and the announce sound of each streak announce kind (web announceSfx).

const COUNT_TICK := "count_tick"
const GO := "go"
const ENDED := "ended"
const TICK_MIN := 1
const TICK_MAX := 3
const ANNOUNCE_EVENTS := {"catalyst": "catalyst", "double": "double_kill", "triple": "triple_kill",
	"singularity": "singularity"}

var _prev_tick := 0
var _went_live := false
var _ended := false

## The cues of one match frame from the countdown label ("3".."1", "" outside the countdown) and the phase.
func step(countdown_label: String, live: bool, ended: bool) -> Array:
	var cues := []
	if countdown_label != "":
		var left := int(countdown_label)
		if left != _prev_tick and left >= TICK_MIN and left <= TICK_MAX:
			cues.append(COUNT_TICK)
		_prev_tick = left
	else:
		_prev_tick = 0
	if live and not _went_live:
		_went_live = true
		cues.append(GO)
	if ended and not _ended:
		_ended = true
		cues.append(ENDED)
	return cues

## The announce sound of a streak announce kind ("" for none).
static func announce_event(kind: String) -> String:
	return ANNOUNCE_EVENTS.get(kind, "")
