class_name MatchSfx extends RefCounted
## Match SFX trigger rules — port of web game/audio/sfx/MatchSfx.ts + windupSfx.ts: the single place for
## "event / state transition -> sound". Your own player sounds 2D (the source would sit on the listener), everyone
## else plays positionally. The engine is duck-typed: play_at(event, pos, gain = 1), play_2d(event, gain = 1),
## has(event) -> bool, start_loop(event, key, target) (null target = 2D loop) and stop_loop(key).
## A frame input is {"id", "target" (Node3D or null), "pos", "shield_active", "dashing", "grounded" (null = unknown),
## "just_jumped", "dash_ready" / "shield_ready" (null except for the local player), "winding_up", "windup_style",
## "is_local"}.

const MOVE_THROTTLE_MS := 100.0          # one landing sound per bounce in auto-bhop
const WINDUP_EVENTS := {"classic": "beam_fire", "rage": "beam_fire_rage", "singularity": "beam_fire_singularity"}
const DEFAULT_WINDUP := "classic"
const EVENT_BEAM_FIRE := "beam_fire"
const EVENT_BLOCK := "block"
const EVENT_DEATH := "death"
const EVENT_RESPAWN := "respawn"
const EVENT_SHIELD_UP := "shield_up"
const EVENT_SHIELD_DOWN := "shield_down"
const EVENT_SHIELD_LOOP := "shield_loop"
const EVENT_DASH := "dash"
const EVENT_LAND := "land"
const EVENT_COOLDOWN_READY := "cooldown_ready"
const SHIELD_LOOP_KEY := "shield:%d"
const KIND_LAND := "land"

var _engine
var _prev := {}                           # id -> last frame's {"shield", "dashing", "grounded", "dash_ready", ...}
var _last_move_ms := {}                   # id -> time of the last landing sound

func _init(engine) -> void:
	_engine = engine

## The whole-shot sound of a windup style, falling back to the classic beam while its asset is missing.
static func windup_event(style: String, engine) -> String:
	var event: String = WINDUP_EVENTS.get(style, WINDUP_EVENTS[DEFAULT_WINDUP])
	return event if engine.has(event) else EVENT_BEAM_FIRE

## Combat facts, voiced at once: a block or a kill at the victim, a respawn where it materialises.
func combat(event: Dictionary, pos_of: Callable) -> void:
	match event.get("t", ""):
		"block":
			_play_at_victim(EVENT_BLOCK, event, pos_of)
		"kill":
			_play_at_victim(EVENT_DEATH, event, pos_of)
		"respawn":
			_engine.play_at(EVENT_RESPAWN, event["pos"])

## Per-frame state diff; returns the landings to broadcast ({"id", "kind", "pos"}).
func frame(inputs: Array, now_ms: float) -> Array:
	var moves := []
	for input in inputs:
		var id: int = input["id"]
		var prev = _prev.get(id)
		var had := func(key: String) -> bool: return prev != null and prev[key] == true
		if input["winding_up"] and not had.call("winding_up"):   # the sound covers the whole shot from the windup start
			_play(input, windup_event(input.get("windup_style", DEFAULT_WINDUP), _engine))
		var key := SHIELD_LOOP_KEY % id
		if input["shield_active"] and not had.call("shield"):
			_play(input, EVENT_SHIELD_UP)
			_engine.start_loop(EVENT_SHIELD_LOOP, key, null if input["is_local"] else input["target"])
		elif not input["shield_active"] and had.call("shield"):
			_play(input, EVENT_SHIELD_DOWN)
			_engine.stop_loop(key)
		if input["dashing"] and not had.call("dashing"):
			_play(input, EVENT_DASH)
		if input["grounded"] == true and prev != null and prev["grounded"] == false \
				and now_ms - float(_last_move_ms.get(id, -INF)) >= MOVE_THROTTLE_MS:
			_play(input, EVENT_LAND)   # a jump itself has no sound
			moves.append({"id": id, "kind": KIND_LAND, "pos": input["pos"]})
			_last_move_ms[id] = now_ms
		if input["dash_ready"] != null and input["shield_ready"] != null and prev != null:
			if (input["dash_ready"] and not prev["dash_ready"]) or (input["shield_ready"] and not prev["shield_ready"]):
				_engine.play_2d(EVENT_COOLDOWN_READY)
		_prev[id] = {"shield": input["shield_active"], "dashing": input["dashing"], "grounded": input["grounded"],
			"dash_ready": true if input["dash_ready"] == null else input["dash_ready"],
			"shield_ready": true if input["shield_ready"] == null else input["shield_ready"],
			"winding_up": input["winding_up"]}
	return moves

## A remote player's landing (its owner's move event), positional.
func move(kind: String, pos: Vector3) -> void:
	_engine.play_at(kind, pos)

## A non-positional match sound (countdown, GO, streak announces).
func play_2d(event: String) -> void:
	_engine.play_2d(event)

## Match end: stop the shield loops and forget every transition.
func reset() -> void:
	for id in _prev:
		_engine.stop_loop(SHIELD_LOOP_KEY % id)
	_prev.clear()
	_last_move_ms.clear()

func _play(input: Dictionary, event: String) -> void:
	if input["is_local"]:
		_engine.play_2d(event)
	else:
		_engine.play_at(event, input["pos"])

func _play_at_victim(sound: String, event: Dictionary, pos_of: Callable) -> void:
	var pos = pos_of.call(int(event["victim"]))
	if pos != null:
		_engine.play_at(sound, pos)
