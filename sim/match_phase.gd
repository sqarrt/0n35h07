class_name MatchPhase extends RefCounted
## Match phases — web Match phase / readySet / maybeStampCountdown: READY (every participant confirms, bots from the
## start) -> COUNTDOWN (players frozen) -> LIVE -> ENDED (players frozen, outcome shown). On a mesh only the lobby
## creator stamps the countdown and ships the phase (`dirty` / `serialize`); every other peer takes it (`apply`).

enum Phase { READY, COUNTDOWN, LIVE, ENDED }

const MS_PER_S := 1000.0
const NAMES := {Phase.READY: "ready", Phase.COUNTDOWN: "countdown", Phase.LIVE: "live", Phase.ENDED: "ended"}

var phase := Phase.READY
var creator := true                            # this peer stamps the countdown (a local match: always)
var dirty := false                             # the creator changed the phase for the mesh (web phaseDirtyFlag)
var _participants: Array[int] = []
var _confirmed := {}                           # id -> true (web readySet)
var _timer := MatchConst.READY_COUNTDOWN_MS    # ms remaining in the countdown

## A seat in the ritual; `ready` confirms it at once (web: bots are auto-ready).
func add_participant(id: int, ready := false) -> void:
	if not _participants.has(id):
		_participants.append(id)
	if ready:
		_confirmed[id] = true

## web markReady: a participant confirms; once everyone has, the creator starts the countdown. Returns whether it was
## news.
func mark_ready(id: int) -> bool:
	if phase != Phase.READY or not _participants.has(id) or _confirmed.has(id):
		return false
	_confirmed[id] = true
	if creator and _participants.all(func(p: int) -> bool: return _confirmed.has(p)):
		phase = Phase.COUNTDOWN
		_timer = MatchConst.READY_COUNTDOWN_MS
		dirty = true
	return true

## The confirmed ids in seat order (web hud.ready).
func ready_ids() -> Array:
	var ids := _confirmed.keys()
	ids.sort()
	return ids

func update(dt: float) -> void:
	if phase == Phase.COUNTDOWN:
		_timer -= dt * MS_PER_S
		if _timer <= 0.0:
			_timer = 0.0
			phase = Phase.LIVE

func is_ready_phase() -> bool:
	return phase == Phase.READY

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

## web forceLiveForTest: everyone ready, straight into the fight.
func force_live() -> void:
	for id in _participants:
		_confirmed[id] = true
	phase = Phase.LIVE
	_timer = 0.0
	dirty = true

## End the match (web endMatch): a live match ends by its clock; `force` ends it from any phase (a disconnect). Once.
func end(force := false) -> void:
	if phase == Phase.LIVE or (force and phase != Phase.ENDED):
		phase = Phase.ENDED
		dirty = true

func reset() -> void:
	phase = Phase.READY
	_confirmed.clear()
	_timer = MatchConst.READY_COUNTDOWN_MS

## web serializePhase: what the creator ships.
func serialize() -> Dictionary:
	return {"phase": NAMES[phase], "ready": ready_ids()}

## web applyPhase: take the creator's phase; entering the countdown starts its full length here.
func apply(message: Dictionary) -> void:
	var next = NAMES.find_key(String(message.get("phase", "")))
	if next == null:
		return
	var entering_countdown: bool = next == Phase.COUNTDOWN and phase != Phase.COUNTDOWN
	phase = next
	_confirmed = {}
	for id in message.get("ready", []):
		_confirmed[int(id)] = true
	if entering_countdown:
		_timer = MatchConst.READY_COUNTDOWN_MS
