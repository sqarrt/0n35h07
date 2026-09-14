class_name ProfileCloud
## The profile's Steam Cloud sync at startup — port of web src/steam/cloudProfile.ts syncProfileOnStartup and
## pushProfileToCloud. The stamp of the last synced version and the SteamID owning the cached profile live in
## user://profile_sync.json (web localStorage oneshot:profile:updatedAt / oneshot:profile:owner). Without Steam nothing
## is read or written. `bridge`: available(), self_id(), persona_name(), cloud_read(name), cloud_write(name, data).

const META_PATH := "user://profile_sync.json"
const META_UPDATED_AT := "updatedAt"
const META_OWNER := "owner"
const MS_PER_S := 1000.0

## Reconcile the local profile with the account's cloud before the game reads it (web: before the app mounts).
static func sync_on_startup(bridge: Object, rng: Callable, profile_path := ProfileStore.DEFAULT_PATH,
		meta_path := META_PATH) -> void:
	if not bridge.available():
		return
	var meta := load_meta(meta_path)
	var current_user: String = bridge.self_id()
	var local_owner := String(meta.get(META_OWNER, ""))
	var has_local := FileAccess.file_exists(profile_path)
	var cloud := CloudProfileSync.parse_blob(bridge.cloud_read(CloudProfileSync.CLOUD_FILE))
	var decision := CloudProfileSync.decide_for_user(cloud, float(meta.get(META_UPDATED_AT, 0.0)), local_owner,
		current_user, has_local)
	var other_account := current_user != "" and local_owner != "" and local_owner != current_user
	match decision["kind"]:
		CloudProfileSync.KIND_ADOPT:
			var adopted: Dictionary = decision["profile"]
			if has_local and not other_account:   # only a confirmed account switch skips the trial merge
				adopted = CloudProfileSync.merge_same_day_trial(adopted, ProfileStore.load_profile(rng, profile_path))
			ProfileStore.save_profile(adopted, rng, profile_path)
			meta[META_UPDATED_AT] = decision["updatedAt"]   # the adopted version is the synced baseline
		CloudProfileSync.KIND_PUSH:
			meta[META_UPDATED_AT] = push(bridge, ProfileStore.load_profile(rng, profile_path))
		CloudProfileSync.KIND_FRESH:
			var fresh := PlayerProfile.random(rng)
			fresh["name"] = CloudProfileSync.first_run_name(true, bridge.persona_name(), fresh["name"])
			ProfileStore.save_profile(fresh, rng, profile_path)
			meta[META_UPDATED_AT] = push(bridge, fresh)
	if current_user != "":
		meta[META_OWNER] = current_user
	save_meta(meta, meta_path)

## Upload `profile` stamped now; returns the stamp, the new local baseline.
static func push(bridge: Object, profile: Dictionary) -> float:
	var updated_at := Time.get_unix_time_from_system() * MS_PER_S   # web Date.now()
	bridge.cloud_write(CloudProfileSync.CLOUD_FILE, CloudProfileSync.blob_json(profile, updated_at))
	return updated_at

static func load_meta(path := META_PATH) -> Dictionary:
	if not FileAccess.file_exists(path):
		return {}
	var json := JSON.new()
	if json.parse(FileAccess.get_file_as_string(path)) != OK or not json.data is Dictionary:
		return {}
	return json.data

static func save_meta(meta: Dictionary, path := META_PATH) -> void:
	var file := FileAccess.open(path, FileAccess.WRITE)
	if file == null:
		push_error("Profile sync state save failed: %s" % error_string(FileAccess.get_open_error()))
		return
	file.store_string(JSON.stringify(meta))
