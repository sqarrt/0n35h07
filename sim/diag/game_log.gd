class_name GameLog
## The session diagnostic log — port of web src/diag/gameLog.ts: one static logger every layer calls, silent until the
## Steam build installs a sink (web installGameLog), each call one formatted line. `sink`: enqueue(line: String).

const HEALTH_HEARTBEAT_MS := 2000               # web HEALTH_HEARTBEAT_MS: the in-match health line
const PHASE_WATCHDOG_MS := 8000                 # web PHASE_WATCHDOG_MS: a pre-live phase this long is stuck

static var _sink: Object = null
static var _iso_now := Callable()               # () -> String; the wall clock unless a test injects one
static var _since_ms := Callable()              # () -> int; milliseconds since the log started
static var _started_ms := 0

## Start logging into `sink`; the clocks default to the system time and the engine ticks.
static func install(sink: Object, iso_now := Callable(), since_ms := Callable()) -> void:
	_sink = sink
	_started_ms = Time.get_ticks_msec()
	_iso_now = iso_now if iso_now.is_valid() else func() -> String:
		return GameLogFormat.iso_utc(Time.get_unix_time_from_system())
	_since_ms = since_ms if since_ms.is_valid() else func() -> int: return Time.get_ticks_msec() - _started_ms

static func uninstall() -> void:
	_sink = null

static func is_active() -> bool:
	return _sink != null

static func log(cat: String, event: String, fields: Dictionary = {}) -> void:
	_emit(GameLogFormat.LEVEL_INFO, cat, event, fields)

static func warn(cat: String, event: String, fields: Dictionary = {}) -> void:
	_emit(GameLogFormat.LEVEL_WARN, cat, event, fields)

static func error(cat: String, event: String, fields: Dictionary = {}) -> void:
	_emit(GameLogFormat.LEVEL_ERROR, cat, event, fields)

## web gameLog.set: record a context change inline.
static func set_context(fields: Dictionary) -> void:
	_emit(GameLogFormat.LEVEL_INFO, "life", "ctx", fields)

static func _emit(level: String, cat: String, event: String, fields: Dictionary) -> void:
	if _sink == null:
		return
	_sink.enqueue(GameLogFormat.format_line(_iso_now.call(), _since_ms.call(), level, cat, event, fields))
