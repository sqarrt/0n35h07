extends GutTest
## RadioLibrary — web tests/unit/radioLibrary.test.ts on a real folder: save, list and read back; a colliding name gets
## " (2)"; folders before tracks and a track moved in; delete a track; rename a track and a folder; delete a folder
## recursively; a malformed track file refused; control files hidden; whole numbers written whole.

const ROOT := "user://test_radio_library"

var _lib: RadioLibrary

func before_each() -> void:
	_remove_tree(ProjectSettings.globalize_path(ROOT))
	_lib = RadioLibrary.new(ROOT)
	_lib.ensure_root()

func after_all() -> void:
	_remove_tree(ProjectSettings.globalize_path(ROOT))

func _track(track_name: String) -> Dictionary:
	return {"v": 2, "id": "seedA:3", "name": track_name, "bpm": 131.0, "bars": 8.0,
		"info": {"mood": "dread", "key": "E", "scale": "minor"},
		"program": "setcpm(131/4)\narrange(\n  // peak (8 bars)\n  [8, stack(note(\"0\"))],\n)"}

func _names(dir: String) -> Array:
	return _lib.list_dir(dir).map(func(entry: Dictionary) -> String: return entry[RadioLibrary.NAME])

func test_saves_a_track_and_lists_and_reads_it_back() -> void:
	var path := _lib.save_track("", _track("Ashen Drift"))
	assert_eq(path, "Ashen Drift.json")
	assert_eq(_lib.list_dir(""), [{RadioLibrary.KIND: RadioLibrary.TRACK, RadioLibrary.NAME: "Ashen Drift",
		RadioLibrary.PATH: "Ashen Drift.json"}])
	var read := _lib.read_track(path)
	assert_eq(read["name"], "Ashen Drift")
	assert_eq(float(read["bpm"]), 131.0)
	assert_true(String(read["program"]).contains("arrange("))

func test_suffixes_a_colliding_track_name() -> void:
	_lib.save_track("", _track("Twin"))
	assert_eq(_lib.save_track("", _track("Twin")), "Twin (2).json")

func test_folders_come_before_tracks_and_a_track_moves_in() -> void:
	_lib.save_track("", _track("Loose"))
	assert_eq(_lib.make_folder("", "Night"), "Night")
	assert_eq(_lib.list_dir("").map(func(e: Dictionary) -> String: return "%s:%s" % [e[RadioLibrary.KIND],
		e[RadioLibrary.NAME]]), ["folder:Night", "track:Loose"])
	assert_eq(_lib.move_track("Loose.json", "Night"), "Night/Loose.json")
	assert_eq(_names(""), ["Night"])
	assert_eq(_names("Night"), ["Loose"])

func test_deletes_a_track() -> void:
	_lib.save_track("", _track("Gone"))
	_lib.delete_track("Gone.json")
	assert_eq(_lib.list_dir(""), [])

func test_renames_a_track_and_a_folder() -> void:
	_lib.save_track("", _track("Old"))
	assert_eq(_lib.rename("Old.json", "New"), "New.json")
	assert_eq(_names(""), ["New"])
	var folder := _lib.make_folder("", "F")
	assert_eq(_lib.rename(folder, "G"), "G")
	assert_eq(_names(""), ["G", "New"])

func test_deletes_a_folder_recursively() -> void:
	var folder := _lib.make_folder("", "Box")
	_lib.save_track(folder, _track("Inside"))
	_lib.delete_track(folder, true)
	assert_eq(_lib.list_dir(""), [])

func test_refuses_a_malformed_track_file() -> void:
	var file := FileAccess.open(ROOT.path_join("Bad.json"), FileAccess.WRITE)
	file.store_string(JSON.stringify({"v": 2, "id": "x", "name": "Bad", "bpm": 120}))
	file.close()
	assert_eq(_lib.read_track("Bad.json"), {}, "web throws: callers skip it")

func test_names_are_cleaned_and_control_files_hidden() -> void:
	assert_eq(_lib.save_track("", _track("_a/b:c")), "a b c.json", "no separators, no hiding prefix")
	_lib.set_marker(".migrated")
	assert_true(_lib.has_marker(".migrated"))
	assert_eq(_names(""), ["a b c"])

func test_whole_numbers_are_written_whole_like_the_web() -> void:
	var path := _lib.save_track("", _track("Plain"))
	var text := FileAccess.get_file_as_string(ROOT.path_join(path))
	assert_true(text.contains("\"bpm\": 131"), "JSON.stringify(payload, null, 2)")
	assert_false(text.contains("131.0"))

func _remove_tree(absolute: String) -> void:
	if not DirAccess.dir_exists_absolute(absolute):
		return
	for sub in DirAccess.get_directories_at(absolute):
		_remove_tree(absolute.path_join(sub))
	for file in DirAccess.get_files_at(absolute):
		DirAccess.remove_absolute(absolute.path_join(file))
	DirAccess.remove_absolute(absolute)
