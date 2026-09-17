class_name GameLogSink extends Node
## The session log file — port of web src/diag/logSink.ts: `<dir>/oneshot-YYYYMMDD-HHMMSS.log`, lines batched and
## appended every second (or at once when 400 wait), old sessions beyond the newest 15 pruned when the session starts,
## and whatever is left flushed on the way out. Lines may arrive from other threads (the engine's logger): the buffer
## is guarded.

const DEFAULT_DIR := "user://logs"             # web $APPDATA/logs
const FLUSH_S := 1.0                           # web LOG_FLUSH_MS
const MAX_BUFFER_LINES := 400                  # web LOG_MAX_BUFFER_LINES

var _dir := DEFAULT_DIR
var _path := ""
var _keep := LogRetention.KEEP_FILES
var _buffer := PackedStringArray()
var _mutex := Mutex.new()
var _flush_left := FLUSH_S

## `now`: a Time datetime dictionary in local time (the session's file name).
func setup(dir := DEFAULT_DIR, now: Dictionary = Time.get_datetime_dict_from_system(), keep := LogRetention.KEEP_FILES) \
		-> void:
	_dir = dir
	_keep = keep
	_path = dir.path_join(GameLogFormat.session_file_name(now))

func _ready() -> void:
	if _path == "":
		setup()
	var absolute := ProjectSettings.globalize_path(_dir)
	DirAccess.make_dir_recursive_absolute(absolute)
	for file_name in LogRetention.files_to_prune(Array(DirAccess.get_files_at(absolute)), _keep):
		DirAccess.remove_absolute(absolute.path_join(file_name))

func session_path() -> String:
	return _path

func enqueue(line: String) -> void:
	_mutex.lock()
	_buffer.append(line)
	var full := _buffer.size() >= MAX_BUFFER_LINES
	_mutex.unlock()
	if full:
		flush()

func flush() -> void:
	_mutex.lock()
	var lines := _buffer
	_buffer = PackedStringArray()
	_mutex.unlock()
	if lines.is_empty() or _path == "":
		return
	var file := FileAccess.open(_path, FileAccess.READ_WRITE) if FileAccess.file_exists(_path) \
		else FileAccess.open(_path, FileAccess.WRITE)
	if file == null:
		return                                  # logging must never break the game
	file.seek_end()
	file.store_string("\n".join(lines) + "\n")
	file.close()

func _process(delta: float) -> void:
	_flush_left -= delta
	if _flush_left > 0.0:
		return
	_flush_left = FLUSH_S
	flush()

func _notification(what: int) -> void:
	if what == NOTIFICATION_WM_CLOSE_REQUEST or what == NOTIFICATION_EXIT_TREE:
		flush()
