extends GutTest
## LogRetention — port of web tests/unit/logRetention.test.ts: only session log files count, the newest `keep` stay.

func test_matches_only_session_log_files() -> void:
	assert_true(LogRetention.is_session_log("oneshot-20260630-012203.log"))
	assert_false(LogRetention.is_session_log("radio.json"))
	assert_false(LogRetention.is_session_log("oneshot-bad.log"))
	assert_false(LogRetention.is_session_log("godot.log"), "the engine's own log stays")

func test_keeps_the_newest_and_prunes_the_rest() -> void:
	var names := ["oneshot-20260630-000001.log", "oneshot-20260630-000003.log", "oneshot-20260630-000002.log", "notes.txt"]
	assert_eq(LogRetention.files_to_prune(names, 2), ["oneshot-20260630-000001.log"])

func test_prunes_nothing_at_or_under_the_cap() -> void:
	assert_eq(LogRetention.files_to_prune(["oneshot-20260630-000001.log"], LogRetention.KEEP_FILES), [])
