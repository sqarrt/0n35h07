extends GutTest
## The session log's call sites speak web's event names — the room and the negotiation (web RoomSession.setMode /
## setMap / setDuration, matchmaking resolveMatchParams): a mode change, a blocked one, the picks and the resolution
## with its no-overlap fallbacks.

const TS := "2026-06-30T00:00:01.000Z"
const PROFILE := {"name": "PARITY7", "primaryColor": "#fa4", "reserveColor": "#4af"}
const INDIA := "os_india"
const PILLARS := "os_pillars"
const GUEST_DURATION := 10

class RecordingSink extends RefCounted:
	var lines: Array = []
	func enqueue(line: String) -> void:
		lines.append(line)

var _sink: RecordingSink

func before_each() -> void:
	_sink = RecordingSink.new()
	GameLog.install(_sink, func() -> String: return TS, func() -> int: return 0)

func after_each() -> void:
	GameLog.uninstall()

func _room() -> RoomModel:
	var rng := func() -> float: return 0.0
	return RoomModel.new(PlayerProfile.sanitize(PROFILE, rng), rng)

func _logged(tail: String) -> bool:
	return _sink.lines.any(func(line: String) -> bool: return line.ends_with(tail))

func test_mode_changes_and_a_blocked_one() -> void:
	var room := _room()
	room.set_mode(GameModes.BATTLE)
	assert_true(_logged("I room mode_set mode=%s" % GameModes.BATTLE), str(_sink.lines))
	room.add_bot(1)
	room.add_bot(2)
	room.set_mode(GameModes.DUEL)
	assert_true(_logged("W room mode_blocked mode=%s occupied=3" % GameModes.DUEL), str(_sink.lines))

func test_picks_and_the_resolution() -> void:
	var room := _room()
	room.set_map([INDIA])
	assert_true(_logged("I nego set_map sel=[%s] mapId=%s" % [INDIA, INDIA]), str(_sink.lines))
	room.resolve_against([PILLARS], [GUEST_DURATION])
	assert_true(_logged("W nego map_no_overlap host=[%s] client=[%s] using=%s" % [INDIA, PILLARS, INDIA]),
		str(_sink.lines))
	assert_true(_sink.lines.any(func(line: String) -> bool: return line.contains("W nego duration_no_overlap")))
	assert_true(_logged("I nego resolved mapId=%s durationMin=%d" % [INDIA, room.duration_min]), str(_sink.lines))
