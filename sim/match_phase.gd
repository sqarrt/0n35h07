class_name MatchPhase extends RefCounted
## Match entry ritual (local): COUNTDOWN (players frozen) -> LIVE.
## The web's full ready-handshake is a lobby/networking concern (#6); local play auto-readies.

enum Phase { COUNTDOWN, LIVE }

var phase := Phase.COUNTDOWN
var _timer := MatchConst.READY_COUNTDOWN_MS   # ms remaining in the countdown

func update(dt: float) -> void:
	if phase == Phase.COUNTDOWN:
		_timer -= dt * 1000.0
		if _timer <= 0.0:
			_timer = 0.0
			phase = Phase.LIVE

func is_live() -> bool:
	return phase == Phase.LIVE

func countdown_remaining_ms() -> float:
	return _timer if phase == Phase.COUNTDOWN else 0.0

## Big number to show during the countdown ("3".."1"); "" when live.
func countdown_label() -> String:
	if phase == Phase.LIVE:
		return ""
	return str(int(ceil(_timer / 1000.0)))

func force_live() -> void:
	phase = Phase.LIVE
	_timer = 0.0

func reset() -> void:
	phase = Phase.COUNTDOWN
	_timer = MatchConst.READY_COUNTDOWN_MS
