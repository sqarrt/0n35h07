class_name RadioLibrarySeed
## The small library web parity-capture-radio-library.mjs seeds its in-memory app-data folder with — two folders, four
## tracks at the root (two of them named Twin), one inside Night Drive — for the explorer's tests and parity captures.

const DISPLAY_ROOT := "C:\\Users\\PARITY7\\AppData\\Roaming\\com.oneshot.game\\radio"   # web APP_DATA + \radio
const FOLDERS := ["Ambient", "Night Drive"]
const ROOT_TRACKS := [["Ashen Drift", 128], ["Fathom XS·17", 134], ["Twin", 122], ["Twin", 122]]
const NESTED_FOLDER := "Night Drive"
const NESTED_TRACK := ["Lagoon", 118]
const FORMAT_VERSION := 2
const BARS := 64
const INFO := {"mood": "dark_techno", "key": "E", "scale": "phrygian"}
const PROGRAM := "setcpm(%d/4)\narrange()"
const ID_FORMAT := "%s:0"

## A web capture track payload.
static func track(track_name: String, bpm: int) -> Dictionary:
	return {"v": FORMAT_VERSION, "id": ID_FORMAT % track_name, "name": track_name, "bpm": bpm, "bars": BARS,
		"info": INFO.duplicate(), "program": PROGRAM % bpm}

## Empty `library`'s root and seed it.
static func seed(library: RadioLibrary) -> void:
	library.ensure_root()
	for entry in library.list_dir(""):
		library.delete_track(entry[RadioLibrary.PATH], true)
	for folder in FOLDERS:
		library.make_folder("", folder)
	for pair in ROOT_TRACKS:
		library.save_track("", track(pair[0], pair[1]))
	library.save_track(NESTED_FOLDER, track(NESTED_TRACK[0], NESTED_TRACK[1]))
