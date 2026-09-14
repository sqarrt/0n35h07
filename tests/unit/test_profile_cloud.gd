extends GutTest
## ProfileCloud — port of web cloudProfile.ts syncProfileOnStartup / installProfileCloudSync on a fake bridge: the
## startup reconcile adopts a newer cloud profile, pushes a newer local one, seeds a first run with the Steam name,
## follows an account switch, leaves everything alone without Steam, and profile saves reach the cloud debounced.

const DIR := "user://test_profile_cloud"
const PROFILE_PATH := DIR + "/profile.json"
const META_PATH := DIR + "/profile_sync.json"
const USER := "76561198000000001"
const OTHER_USER := "76561198000000002"
const PERSONA := "Alice"
const OLD_TS := 1000.0
const NEW_TS := 2000.0
const DEBOUNCE_PART_S := 0.6          # two of these pass ProfileCloudPusher.DEBOUNCE_S, one does not

class FakeBridge extends RefCounted:
	var steam := true
	var user := ""
	var persona := ""
	var files := {}
	var writes := 0
	func available() -> bool:
		return steam
	func self_id() -> String:
		return user
	func persona_name() -> String:
		return persona
	func cloud_read(file_name: String):
		return files.get(file_name)
	func cloud_write(file_name: String, data: String) -> bool:
		files[file_name] = data
		writes += 1
		return true

var _rng := func() -> float: return 0.5

func before_each() -> void:
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(DIR))
	for path in [PROFILE_PATH, META_PATH]:
		if FileAccess.file_exists(path):
			DirAccess.remove_absolute(ProjectSettings.globalize_path(path))

func _bridge(user := USER) -> FakeBridge:
	var bridge := FakeBridge.new()
	bridge.user = user
	bridge.persona = PERSONA
	return bridge

func _profile(profile_name: String) -> Dictionary:
	var profile := PlayerProfile.random(_rng)
	profile["name"] = profile_name
	return profile

func _cloud(bridge: FakeBridge, profile: Dictionary, updated_at: float) -> void:
	bridge.files[CloudProfileSync.CLOUD_FILE] = CloudProfileSync.blob_json(profile, updated_at)

func _meta(updated_at: float, owner: String) -> void:
	ProfileCloud.save_meta({ProfileCloud.META_UPDATED_AT: updated_at, ProfileCloud.META_OWNER: owner}, META_PATH)

func _sync(bridge: FakeBridge) -> void:
	ProfileCloud.sync_on_startup(bridge, _rng, PROFILE_PATH, META_PATH)

func test_a_newer_cloud_profile_is_adopted() -> void:
	var bridge := _bridge()
	ProfileStore.save_profile(_profile("LOCAL"), _rng, PROFILE_PATH)
	_meta(OLD_TS, USER)
	_cloud(bridge, _profile("CLOUD"), NEW_TS)
	_sync(bridge)
	assert_eq(ProfileStore.load_profile(_rng, PROFILE_PATH)["name"], "CLOUD")
	assert_eq(ProfileCloud.load_meta(META_PATH)[ProfileCloud.META_UPDATED_AT], NEW_TS, "the synced baseline")
	assert_eq(bridge.writes, 0, "adopting doesn't echo back")

func test_a_newer_local_profile_is_pushed() -> void:
	var bridge := _bridge()
	ProfileStore.save_profile(_profile("LOCAL"), _rng, PROFILE_PATH)
	_meta(NEW_TS, USER)
	_cloud(bridge, _profile("CLOUD"), OLD_TS)
	_sync(bridge)
	var blob := CloudProfileSync.parse_blob(bridge.files[CloudProfileSync.CLOUD_FILE])
	assert_eq(blob["profile"]["name"], "LOCAL")
	assert_gt(blob["updatedAt"], NEW_TS, "stamped now")

func test_a_first_run_takes_the_steam_name() -> void:
	var bridge := _bridge()
	_sync(bridge)
	assert_eq(ProfileStore.load_profile(_rng, PROFILE_PATH)["name"], PERSONA)
	var blob := CloudProfileSync.parse_blob(bridge.files[CloudProfileSync.CLOUD_FILE])
	assert_eq(blob["profile"]["name"], PERSONA, "the account's cloud is established")
	assert_eq(ProfileCloud.load_meta(META_PATH)[ProfileCloud.META_OWNER], USER)

func test_an_account_switch_takes_that_accounts_cloud() -> void:
	var bridge := _bridge()
	ProfileStore.save_profile(_profile("LOCAL"), _rng, PROFILE_PATH)
	_meta(NEW_TS, OTHER_USER)
	_cloud(bridge, _profile("CLOUD"), OLD_TS)
	_sync(bridge)
	assert_eq(ProfileStore.load_profile(_rng, PROFILE_PATH)["name"], "CLOUD")
	assert_eq(ProfileCloud.load_meta(META_PATH)[ProfileCloud.META_OWNER], USER)

func test_without_steam_nothing_is_touched() -> void:
	var bridge := _bridge()
	bridge.steam = false
	_sync(bridge)
	assert_false(FileAccess.file_exists(PROFILE_PATH))
	assert_false(FileAccess.file_exists(META_PATH))
	assert_eq(bridge.writes, 0)

func test_saves_reach_the_cloud_debounced() -> void:
	var bridge := _bridge()
	var pusher := ProfileCloudPusher.new()
	pusher.setup(bridge, META_PATH)
	add_child_autofree(pusher)
	pusher.queue(_profile("FIRST"))
	pusher.queue(_profile("SECOND"))
	pusher._process(DEBOUNCE_PART_S)
	assert_eq(bridge.writes, 0, "still coalescing")
	pusher._process(DEBOUNCE_PART_S)
	assert_eq(bridge.writes, 1, "one upload")
	var blob := CloudProfileSync.parse_blob(bridge.files[CloudProfileSync.CLOUD_FILE])
	assert_eq(blob["profile"]["name"], "SECOND", "the latest save")
