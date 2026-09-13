class_name ProfileStore
## Profile persistence — port of web settings.ts loadProfile / saveProfile with user:// in place of localStorage
## (the web key "oneshot:profile"). A missing or corrupt file creates a random profile and saves it at once.

const DEFAULT_PATH := "user://profile.json"

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
	file.store_string(JSON.stringify(PlayerProfile.sanitize(profile, rng)))
