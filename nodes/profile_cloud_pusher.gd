class_name ProfileCloudPusher extends Node
## Profile saves reach Steam Cloud — port of web cloudProfile.ts installProfileCloudSync: every save schedules an upload
## of the latest profile, and saves within DEBOUNCE_S of each other coalesce into one.

const DEBOUNCE_S := 1.0                         # web PUSH_DEBOUNCE_MS

var _bridge: Object
var _meta_path := ProfileCloud.META_PATH
var _pending := {}
var _left := 0.0

func setup(bridge: Object, meta_path := ProfileCloud.META_PATH) -> void:
	_bridge = bridge
	_meta_path = meta_path

## A profile was saved: upload it once the saves settle (the timer restarts).
func queue(profile: Dictionary) -> void:
	_pending = profile
	_left = DEBOUNCE_S

func _process(delta: float) -> void:
	if _pending.is_empty():
		return
	_left -= delta
	if _left > 0.0:
		return
	var meta := ProfileCloud.load_meta(_meta_path)
	meta[ProfileCloud.META_UPDATED_AT] = ProfileCloud.push(_bridge, _pending)
	ProfileCloud.save_meta(meta, _meta_path)
	_pending = {}
