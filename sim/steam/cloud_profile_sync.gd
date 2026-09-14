class_name CloudProfileSync
## The profile on Steam Cloud — the pure decisions of web src/steam/cloudProfile.ts: the versioned blob, last-write-wins
## against the local stamp, the profile bound to the Steam account, the radio trial kept at its highest for the same day,
## and the Steam persona name for a first run (web settings.ts chooseFirstRunName). Users are SteamID strings, "" unknown.

const CLOUD_FILE := "profile.json"
const BLOB_VERSION := 1
const KIND_ADOPT := "adopt"                     # the cloud is newer: take it
const KIND_PUSH := "push"                       # the local profile is newer, or there is no cloud: upload it
const KIND_NOOP := "noop"                       # already in sync
const KIND_FRESH := "fresh"                     # first run for this account: a new profile named after the persona
const TRIAL_KEY := "radioTrial"
const TRIAL_DAY := "day"
const TRIAL_GENS := "gens"
const TRIAL_SAVES := "saves"

## A raw cloud file as {v, updatedAt, profile}, or {} when absent, garbage or another version.
static func parse_blob(raw) -> Dictionary:
	if not raw is String or raw == "":
		return {}
	var json := JSON.new()   # parse() reports garbage by code, without an engine error
	if json.parse(raw) != OK or not json.data is Dictionary:
		return {}
	var blob: Dictionary = json.data
	var version = blob.get("v")
	var updated_at = blob.get("updatedAt")
	if not _is_number(version) or version != BLOB_VERSION:
		return {}
	if not _is_number(updated_at) or not is_finite(float(updated_at)) or not blob.get("profile") is Dictionary:
		return {}
	return {"v": BLOB_VERSION, "updatedAt": float(updated_at), "profile": blob["profile"]}

static func blob_json(profile: Dictionary, updated_at: float) -> String:
	return JSON.stringify({"v": BLOB_VERSION, "updatedAt": updated_at, "profile": profile})

## Last-write-wins: `cloud` as parse_blob returns it, `local_ts` the stamp of the last synced local version.
static func decide(cloud: Dictionary, local_ts: float) -> Dictionary:
	if cloud.is_empty():
		return {"kind": KIND_PUSH}
	if cloud["updatedAt"] > local_ts:
		return _adopt(cloud)
	if cloud["updatedAt"] < local_ts:
		return {"kind": KIND_PUSH}
	return {"kind": KIND_NOOP}

## Last-write-wins bound to the account (web decideProfileSyncForUser): Steam unknown, a profile from before the owner
## tag, or our own account keep plain LWW; a first run or another account ignores the local cache.
static func decide_for_user(cloud: Dictionary, local_ts: float, local_owner: String, current_user: String,
		has_local_profile: bool) -> Dictionary:
	if current_user == "" or (local_owner == "" and has_local_profile) or local_owner == current_user:
		return decide(cloud, local_ts)
	return {"kind": KIND_FRESH} if cloud.is_empty() else _adopt(cloud)

## Adopting the cloud profile must not refund the radio trial of the same day: the higher gens and saves of both win.
static func merge_same_day_trial(adopted: Dictionary, local: Dictionary) -> Dictionary:
	var cloud_trial = adopted.get(TRIAL_KEY)
	var local_trial = local.get(TRIAL_KEY)
	if not cloud_trial is Dictionary or not local_trial is Dictionary \
			or cloud_trial.get(TRIAL_DAY) != local_trial.get(TRIAL_DAY):
		return adopted
	var merged := adopted.duplicate()
	merged[TRIAL_KEY] = {TRIAL_DAY: cloud_trial[TRIAL_DAY],
		TRIAL_GENS: maxi(cloud_trial[TRIAL_GENS], local_trial[TRIAL_GENS]),
		TRIAL_SAVES: maxi(cloud_trial[TRIAL_SAVES], local_trial[TRIAL_SAVES])}
	return merged

## A new profile's name: the trimmed Steam persona name when there is one, else the generated fallback.
static func first_run_name(is_new: bool, steam_name: String, fallback: String) -> String:
	var trimmed := steam_name.strip_edges()
	return trimmed if is_new and trimmed != "" else fallback

static func _adopt(cloud: Dictionary) -> Dictionary:
	return {"kind": KIND_ADOPT, "profile": cloud["profile"], "updatedAt": cloud["updatedAt"]}

static func _is_number(value) -> bool:
	return value is float or value is int
