class_name GameLogErrors extends Logger
## Uncaught errors into the session log — web installGameLog hooks window 'error' / 'unhandledrejection' as
## `life uncaught`; here the engine's error stream (script errors included) does, registered with OS.add_logger. Called
## from any thread; a line the log itself raises is not logged again.

static var _inside := false

func _log_error(function: String, file: String, line: int, code: String, rationale: String, _editor_notify: bool,
		_error_type: int, _script_backtraces: Array[ScriptBacktrace]) -> void:
	if _inside:
		return
	_inside = true
	GameLog.error("life", "uncaught", {"msg": rationale if rationale != "" else code, "src": file, "line": line,
		"fn": function})
	_inside = false

func _log_message(_message: String, _error: bool) -> void:
	pass
