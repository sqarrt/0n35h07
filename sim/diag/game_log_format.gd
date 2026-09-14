class_name GameLogFormat
## The session log's line format — port of web src/diag/logFormat.ts: `ISO +ms level cat event key=value ...`, greppable
## fields (whole numbers without a point, fractions to 3 digits, arrays in brackets, strings with a space or `=` quoted,
## objects as JSON) and a sortable per-session file name in local time.

const LEVEL_INFO := "info"
const LEVEL_WARN := "warn"
const LEVEL_ERROR := "error"
const LEVEL_CHAR := {LEVEL_INFO: "I", LEVEL_WARN: "W", LEVEL_ERROR: "E"}
const FRACTION_SCALE := 1000.0                  # web Math.round(v * 1000) / 1000
const MS_PER_S := 1000.0
const FILE_PREFIX := "oneshot-"
const FILE_SUFFIX := ".log"

static var _needs_quotes := RegEx.create_from_string("\\s|=")

static func format_line(ts_iso: String, since_ms: int, level: String, cat: String, event: String,
		fields: Dictionary = {}) -> String:
	var head := "%s +%d %s %s %s" % [ts_iso, since_ms, LEVEL_CHAR[level], cat, event]
	var tail := fmt_fields(fields)
	return head + " " + tail if tail != "" else head

static func fmt_fields(fields: Dictionary) -> String:
	var parts := PackedStringArray()
	for key in fields:
		parts.append("%s=%s" % [key, fmt_val(fields[key])])
	return " ".join(parts)

static func fmt_val(value) -> String:
	if value is int:
		return str(value)
	if value is float:
		return str(int(value)) if is_equal_approx(value, roundf(value)) and absf(value) < float(1 << 53) \
			else str(roundf(value * FRACTION_SCALE) / FRACTION_SCALE)
	if value is Array or value is PackedStringArray or value is PackedInt32Array or value is PackedFloat32Array:
		return "[%s]" % ",".join(Array(value).map(func(v) -> String: return fmt_val(v)))
	if value is Vector3:
		return fmt_val([value.x, value.y, value.z])
	if value is String or value is StringName:
		return "\"%s\"" % value if _needs_quotes.search(String(value)) != null else String(value)
	if value == null:
		return "null"
	if value is Dictionary:
		return JSON.stringify(value)
	return str(value)

## `oneshot-YYYYMMDD-HHMMSS.log` from a Time datetime dictionary in local time.
static func session_file_name(now: Dictionary) -> String:
	return "%s%04d%02d%02d-%02d%02d%02d%s" % [FILE_PREFIX, now["year"], now["month"], now["day"], now["hour"],
		now["minute"], now["second"], FILE_SUFFIX]

## A Unix time (seconds, fractional) as JavaScript's Date.toISOString: UTC with milliseconds and a trailing Z.
static func iso_utc(unix_s: float) -> String:
	var whole := floori(unix_s)
	var ms := clampi(roundi((unix_s - whole) * MS_PER_S), 0, int(MS_PER_S) - 1)
	return "%s.%03dZ" % [Time.get_datetime_string_from_unix_time(whole, false), ms]
