class_name LogRetention
## Session log retention — port of web src/diag/logRetention.ts: only `oneshot-YYYYMMDD-HHMMSS.log` files count, their
## names sort chronologically, and all but the newest `keep` are pruned (the engine's own godot.log is left alone).

const KEEP_FILES := 15                          # web LOG_KEEP_FILES

static var _session_log := RegEx.create_from_string("^oneshot-\\d{8}-\\d{6}\\.log$")

static func is_session_log(file_name: String) -> bool:
	return _session_log.search(file_name) != null

## The session logs to delete so only the `keep` newest remain, oldest first.
static func files_to_prune(names: Array, keep: int) -> Array:
	var logs := names.filter(func(n) -> bool: return is_session_log(String(n)))
	logs.sort()
	return [] if logs.size() <= keep else logs.slice(0, logs.size() - keep)
