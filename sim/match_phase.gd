class_name MatchPhase extends RefCounted
## Match phases (local): COUNTDOWN (players frozen) -> LIVE -> ENDED (players frozen, outcome shown).
## The web's full ready-handshake is a lobby/networking concern (#6); local play auto-readies.

enum Phase { COUNTDOWN, LIVE, ENDED }

const MS_PER_S := 1000.0

var phase := Phase.COUNTDOWN
var _timer := MatchConst.READY_COUNTDOWN_MS   # ms remaining in the countdown

func update(dt: float) -> void:
	if phase == Phase.COUNTDOWN:
		_timer -= dt * MS_PER_S
		if _timer <= 0.0:
			_timer = 0.0
			phase = Phase.LIVE

func is_live() -> bool:
	return phase == Phase.LIVE

func is_ended() -> bool:
	return phase == Phase.ENDED

func countdown_remaining_ms() -> float:
	return _timer if phase == Phase.COUNTDOWN else 0.0

## Big number to show during the countdown ("3".."1"); "" in every other phase.
func countdown_label() -> String:
	if phase != Phase.COUNTDOWN:
		return ""
	return str(int(ceil(_timer / MS_PER_S)))

func force_live() -> void:
	phase = Phase.LIVE
	_timer = 0.0

## End the match (web endMatch): only a live match can end, and it ends once.
func end() -> void:
	if phase == Phase.LIVE:
		phase = Phase.ENDED

func reset() -> void:
	phase = Phase.COUNTDOWN
	_timer = MatchConst.READY_COUNTDOWN_MS
