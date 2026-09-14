class_name DemoClip extends RefCounted
## A recorded match for the trailer — port of web game/demo/demoTypes: the roster, whose eyes it was recorded through,
## the map and frame-independent frames (the camera, every player's absolute state, the match clock and that frame's
## events), so any contiguous range replays on its own. Frames stay the recording's dictionaries; the helpers turn them
## into the shapes the port uses.

const PATH := "res://assets/demos/%s.demo.json"
const MS_PER_S := 1000.0

var map_id := ""
var local_id := 0
var reserve_color := ""                        # the local player's planet ring colour ("" = the profile's)
var roster: Array = []                         # web RosterEntry dictionaries
var frames: Array = []

static func load_clip(id: String) -> DemoClip:
	var json := JSON.new()
	if json.parse(FileAccess.get_file_as_string(PATH % id)) != OK or not (json.data is Dictionary):
		return null
	return from_data(json.data)

static func from_data(data: Dictionary) -> DemoClip:
	var clip := DemoClip.new()
	clip.map_id = String(data.get("mapId", ""))
	clip.local_id = int(data.get("localId", 0))
	clip.reserve_color = String(data.get("reserveColor", ""))
	clip.roster = data.get("roster", [])
	clip.frames = data.get("frames", [])
	return clip

func time_ms(index: int) -> float:
	return float(frames[index]["tMs"])

## The recording camera of a frame: position, rotation (three.js and Godot share Y-up, -Z forward) and vertical fov.
static func camera(frame: Dictionary) -> Dictionary:
	var cam: Dictionary = frame["cam"]
	var p: Array = cam["p"]
	var q: Array = cam["q"]
	return {"position": Vector3(p[0], p[1], p[2]), "rotation": Quaternion(q[0], q[1], q[2], q[3]), "fov": float(cam["fov"])}

## A frame player's state as a NetProtocol snapshot with the demo's HUD fields (web toSnap + DemoPlayerState).
static func snapshot(state: Dictionary) -> Dictionary:
	var aim := Vector3(state["aimDir"][0], state["aimDir"][1], state["aimDir"][2])
	var look := aim.normalized() if aim.length_squared() > 0.0 else Vector3.FORWARD
	return {"id": int(state["id"]), "pos": state["pos"], "aim": [look.x, look.y, look.z], "alive": bool(state["alive"]),
		"respawning": bool(state["respawning"]), "shield": bool(state["shieldActive"]), "dashing": bool(state["dashing"]),
		"windup": float(state["windupProgress"]), "beam": float(state.get("beamCooldown", RemoteState.READY)),
		"dash_ready": float(state.get("dashCooldown", RemoteState.READY)),
		"shield_ready": float(state.get("shieldProgress", RemoteState.READY)),
		"respawn_left": float(state.get("respawnProgress", 0.0))}

## web hudOf: the whole seconds the frame's match clock shows.
static func seconds_left(frame: Dictionary) -> int:
	return int(ceil(float(frame["remainingMs"]) / MS_PER_S))
