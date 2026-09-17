extends GutTest
## GameLog + GameLogSink — port of web src/diag/gameLog.ts and logSink.ts: nothing is written until the log is installed
## (the Steam build only), each call becomes one formatted line with its level, the context lands as `life ctx`, and the
## session file keeps the 15 newest sessions, flushing every second or once 400 lines wait.

const DIR := "user://test_game_log"
const TS := "2026-06-30T00:00:01.000Z"
const SINCE_MS := 5
const NOW := {"year": 2026, "month": 9, "day": 14, "hour": 23, "minute": 30, "second": 5}
const OLD_SESSIONS := 16
const FLUSH_PART_S := 0.6             # two of these pass GameLogSink.FLUSH_S, one does not

class RecordingSink extends RefCounted:
	var lines: Array = []
	func enqueue(line: String) -> void:
		lines.append(line)

func before_each() -> void:
	GameLog.uninstall()
	var absolute := ProjectSettings.globalize_path(DIR)
	DirAccess.make_dir_recursive_absolute(absolute)
	for file_name in DirAccess.get_files_at(absolute):
		DirAccess.remove_absolute(absolute.path_join(file_name))

func after_each() -> void:
	GameLog.uninstall()

func _install() -> RecordingSink:
	var sink := RecordingSink.new()
	GameLog.install(sink, func() -> String: return TS, func() -> int: return SINCE_MS)
	return sink

func _session_lines() -> PackedStringArray:
	var sink_path := DIR.path_join(GameLogFormat.session_file_name(NOW))
	if not FileAccess.file_exists(sink_path):
		return PackedStringArray()
	return FileAccess.get_file_as_string(sink_path).split("\n", false)

func test_nothing_is_written_before_install() -> void:
	var sink := RecordingSink.new()
	GameLog.log("act", "fire", {"id": 1})
	assert_false(GameLog.is_active())
	assert_eq(sink.lines, [])

func test_each_call_is_one_line_with_its_level() -> void:
	var sink := _install()
	GameLog.log("act", "fire", {"id": 1})
	GameLog.warn("room", "mode_blocked", {"mode": "ffa"})
	GameLog.error("life", "uncaught")
	assert_eq(sink.lines, [TS + " +5 I act fire id=1", TS + " +5 W room mode_blocked mode=ffa", TS + " +5 E life uncaught"])

func test_the_context_is_logged_inline() -> void:
	var sink := _install()
	GameLog.set_context({"role": "creator", "localId": 0})
	assert_eq(sink.lines, [TS + " +5 I life ctx role=creator localId=0"])

func test_starting_a_session_prunes_old_sessions() -> void:
	for i in OLD_SESSIONS:
		var old := FileAccess.open(DIR.path_join("oneshot-20260901-0000%02d.log" % i), FileAccess.WRITE)
		old.close()
	var notes := FileAccess.open(DIR.path_join("godot.log"), FileAccess.WRITE)
	notes.close()
	var sink := GameLogSink.new()
	sink.setup(DIR, NOW)
	add_child_autofree(sink)
	var left := DirAccess.get_files_at(ProjectSettings.globalize_path(DIR))
	assert_eq(Array(left).filter(func(n: String) -> bool: return LogRetention.is_session_log(n)).size(),
		LogRetention.KEEP_FILES, "the 15 newest stay")
	assert_true(left.has("oneshot-20260901-000015.log"), "the newest old session stays")
	assert_false(left.has("oneshot-20260901-000000.log"), "the oldest goes")
	assert_true(left.has("godot.log"), "other files stay")

func test_lines_flush_every_second() -> void:
	var sink := GameLogSink.new()
	sink.setup(DIR, NOW)
	add_child_autofree(sink)
	sink.enqueue("first")
	sink.enqueue("second")
	sink._process(FLUSH_PART_S)
	assert_eq(_session_lines().size(), 0, "still batching")
	sink._process(FLUSH_PART_S)
	assert_eq(_session_lines(), PackedStringArray(["first", "second"]))
	assert_true(LogRetention.is_session_log(sink.session_path().get_file()))

func test_a_full_buffer_flushes_at_once() -> void:
	var sink := GameLogSink.new()
	sink.setup(DIR, NOW)
	add_child_autofree(sink)
	for i in GameLogSink.MAX_BUFFER_LINES:
		sink.enqueue("line %d" % i)
	assert_eq(_session_lines().size(), GameLogSink.MAX_BUFFER_LINES)
