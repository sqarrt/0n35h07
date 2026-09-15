class_name RadioLibrary extends RefCounted
## The Radio's on-disk track library — port of web src/radio/library/radioLibrary.ts over a real folder: by default the
## desktop build's own (Tauri app data `com.oneshot.game/radio`, so a player's saved tracks carry over). Paths are
## library-relative ("" = root, "Folder", "Folder/Track.json"); entries starting with "_" or "." are hidden control files.
## A track is a `<name>.json` baked favourite ({v: 2, id, name, bpm, bars, info, program}); a name collision gets " (2)",
## " (3)"…; names lose path separators, illegal characters and hiding prefixes. File operations are synchronous here.

const APP_ID := "com.oneshot.game"             # web src-tauri tauri.conf.json identifier (Tauri's app data folder)
const ROOT_NAME := "radio"                      # web tauriFs ROOT
const TRACK_EXT := ".json"
const HIDDEN_PREFIX := "_"
const MARKER_PREFIX := "."
const SEPARATOR := "/"
const FALLBACK_NAME := "track"                  # web sanitizeName: what an empty name becomes
const COLLISION_FORMAT := "%s (%d)"
const JSON_INDENT := "  "                       # web JSON.stringify(payload, null, 2)
const MARKER_CONTENT := "1"
const KIND := "kind"
const NAME := "name"
const PATH := "path"
const FOLDER := "folder"
const TRACK := "track"
const ILLEGAL := "[\\\\/:*?\"<>|]+"
const SPACES := "\\s+"
const HIDING_PREFIXES := "^[._]+"

var _root: String

## `root`: the library folder (a user:// path or an absolute one); the desktop build's by default.
func _init(root := "") -> void:
	_root = root if root != "" else default_root()

## Tauri's app data folder for the game: the OS data dir (Windows %APPDATA%), the app id, the radio root.
static func default_root() -> String:
	return OS.get_data_dir().path_join(APP_ID).path_join(ROOT_NAME)

## web trackId: a live track's stable id.
static func track_id(seed: String, index: int) -> String:
	return "%s:%d" % [seed, index]

## web sanitizeName: separators and illegal filename characters to spaces, spaces collapsed, hiding prefixes dropped.
static func sanitize_name(raw: String) -> String:
	var cleaned := RegEx.create_from_string(ILLEGAL).sub(raw, " ", true)
	cleaned = RegEx.create_from_string(SPACES).sub(cleaned, " ", true).strip_edges()
	cleaned = RegEx.create_from_string(HIDING_PREFIXES).sub(cleaned, "").strip_edges()
	return cleaned if cleaned != "" else FALLBACK_NAME

## The library's absolute OS path (the explorer's address bar).
func root_abs() -> String:
	return ProjectSettings.globalize_path(_root)

func ensure_root() -> void:
	DirAccess.make_dir_recursive_absolute(_full(""))

## Folders then tracks in `dir`, each sorted by name (control files hidden): [{kind, name, path}].
func list_dir(dir: String) -> Array:
	var folders := []
	var tracks := []
	var absolute := _full(dir)
	for folder in DirAccess.get_directories_at(absolute):
		if not _hidden(folder):
			folders.append({KIND: FOLDER, NAME: folder, PATH: _join(dir, folder)})
	for file in DirAccess.get_files_at(absolute):
		if not _hidden(file) and file.ends_with(TRACK_EXT):
			tracks.append({KIND: TRACK, NAME: file.trim_suffix(TRACK_EXT), PATH: _join(dir, file)})
	folders.sort_custom(_by_name)
	tracks.sort_custom(_by_name)
	return folders + tracks

## The track file parsed and checked (a program, a name, a bpm, finite bars), or {} for a corrupt or hand-edited one.
func read_track(path: String) -> Dictionary:
	var data = JSON.parse_string(FileAccess.get_file_as_string(_full(path)))
	if not (data is Dictionary) or not (data.get("program") is String) or String(data["program"]).is_empty() \
			or not (data.get(NAME) is String) or not _is_number(data.get("bpm")) or not _is_number(data.get("bars")) \
			or not is_finite(float(data["bars"])):
		return {}
	return data

## Write `payload` into `folder` as `<name>.json` (the web's 2-space JSON, whole numbers whole); returns its path.
func save_track(folder: String, payload: Dictionary) -> String:
	var path := _free_path(folder, sanitize_name(str(payload.get(NAME, ""))), TRACK_EXT)
	var file := FileAccess.open(_full(path), FileAccess.WRITE)
	file.store_string(JSON.stringify(_whole_numbers(payload), JSON_INDENT, false))
	file.close()
	return path

## Delete a track file, or a folder with everything in it (`recursive`).
func delete_track(path: String, recursive := false) -> void:
	var absolute := _full(path)
	if recursive and DirAccess.dir_exists_absolute(absolute):
		_remove_tree(absolute)
	else:
		DirAccess.remove_absolute(absolute)

## Rename a track or a folder in place, collision-safe; returns the new path.
func rename(path: String, new_name: String) -> String:
	var slash := path.rfind(SEPARATOR)
	var parent := path.substr(0, slash) if slash >= 0 else ""
	var destination := _free_path(parent, sanitize_name(new_name), TRACK_EXT if path.ends_with(TRACK_EXT) else "")
	if destination != path:
		DirAccess.rename_absolute(_full(path), _full(destination))
	return destination

## A subfolder, collision-safe; returns its path.
func make_folder(parent: String, folder_name: String) -> String:
	var path := _free_path(parent, sanitize_name(folder_name), "")
	DirAccess.make_dir_recursive_absolute(_full(path))
	return path

## Move a track file into `destination_folder`, collision-safe; returns the new path.
func move_track(path: String, destination_folder: String) -> String:
	var file := path.substr(path.rfind(SEPARATOR) + 1)
	var destination := _free_path(destination_folder, file.trim_suffix(TRACK_EXT), TRACK_EXT)
	if destination == path:
		return path
	DirAccess.rename_absolute(_full(path), _full(destination))
	return destination

## One-time markers (".migrated"): hidden control files at the root.
func has_marker(marker: String) -> bool:
	return FileAccess.file_exists(_full(marker))

func set_marker(marker: String) -> void:
	var file := FileAccess.open(_full(marker), FileAccess.WRITE)
	file.store_string(MARKER_CONTENT)
	file.close()

func _full(path: String) -> String:
	return _root if path.is_empty() else _root.path_join(path)

static func _join(dir: String, entry: String) -> String:
	return entry if dir.is_empty() else dir + SEPARATOR + entry

static func _hidden(entry: String) -> bool:
	return entry.begins_with(HIDDEN_PREFIX) or entry.begins_with(MARKER_PREFIX)

## web localeCompare: case-insensitive, lower case first on a tie.
static func _by_name(a: Dictionary, b: Dictionary) -> bool:
	var order := String(a[NAME]).nocasecmp_to(b[NAME])
	return order < 0 if order != 0 else String(a[NAME]) > String(b[NAME])

## The first free `<dir>/<base><suffix><ext>`: "", " (2)", " (3)"…
func _free_path(dir: String, base: String, ext: String) -> String:
	var attempt := 1
	while true:
		var entry := (base if attempt == 1 else COLLISION_FORMAT % [base, attempt]) + ext
		var path := _join(dir, entry)
		if not FileAccess.file_exists(_full(path)) and not DirAccess.dir_exists_absolute(_full(path)):
			return path
		attempt += 1
	return ""

static func _is_number(value: Variant) -> bool:
	return value is float or value is int

## JSON numbers arrive as floats: whole ones go back out as integers, like the web's JSON.stringify.
static func _whole_numbers(value: Variant) -> Variant:
	if value is float and is_finite(value) and value == floorf(value):
		return int(value)
	if value is Dictionary:
		var out := {}
		for key in value:
			out[key] = _whole_numbers(value[key])
		return out
	if value is Array:
		return value.map(func(item: Variant) -> Variant: return _whole_numbers(item))
	return value

static func _remove_tree(absolute: String) -> void:
	for sub in DirAccess.get_directories_at(absolute):
		_remove_tree(absolute.path_join(sub))
	for file in DirAccess.get_files_at(absolute):
		DirAccess.remove_absolute(absolute.path_join(file))
	DirAccess.remove_absolute(absolute)
