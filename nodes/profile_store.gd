class_name ProfileStore
## Profile persistence — port of web settings.ts loadProfile / saveProfile with user:// in place of localStorage
## (the web key "oneshot:profile"). A missing or corrupt file creates a random profile and saves it at once.

const DEFAULT_PATH := "user://profile.json"

## Called with the saved profile after every save (web setProfileSaveHook): the Steam Cloud push; unset in tests.
static var save_hook := Callable()

static func load_profile(rng: Callable, path := DEFAULT_PATH) -> Dictionary:
	if FileAccess.file_exists(path):
		var json := JSON.new()   # parse() reports corrupt data by code, without an engine error
		if json.parse(FileAccess.get_file_as_string(path)) == OK and json.data is Dictionary:
			return PlayerProfile.sanitize(json.data, rng)
	var fresh := PlayerProfile.random(rng)
	save_profile(fresh, rng, path)
	return fresh

static func save_profile(profile: Dictionary, rng: Callable, path := DEFAULT_PATH) -> void:
	var file := FileAccess.open(path, FileAccess.WRITE)
	if file == null:
		push_error("Profile save failed: %s" % error_string(FileAccess.get_open_error()))
		return
	var clean := PlayerProfile.sanitize(profile, rng)
	file.store_string(JSON.stringify(clean))
	file.close()
	if save_hook.is_valid():
		save_hook.call(clean)
