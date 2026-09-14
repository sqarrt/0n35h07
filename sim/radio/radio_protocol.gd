class_name RadioProtocol
## The JSON messages between Godot and the radio host page (web-reference src/radio/host/hostProtocol.ts): the commands
## Godot posts — their names and fields exactly as the page parses them — and the events the page posts back.

const CMD := "cmd"
const EVENT := "event"
const INIT := "init"
const RESUME := "resume"
const PAUSE := "pause"
const STOP := "stop"
const NEXT := "next"
const PREV := "prev"
const RESUME_GENERATIVE := "resume-generative"
const SEEK := "seek"
const VOLUME := "volume"
const GATE := "gate"
const PLAY_TRACK := "play-track"
const PLAY_BAKED := "play-baked"
const EVENT_READY := "ready"
const EVENT_INIT_STATE := "init-state"
const EVENT_STATE := "state"
const EVENT_PROGRESS := "progress"
const EVENT_METER := "meter"
const EVENT_TRACK_END := "track-end"
const EVENT_GENERATED := "generated"

## A command with its fields.
static func command(name: String, fields := {}) -> String:
	var message := {CMD: name}
	message.merge(fields)
	return JSON.stringify(message)

## Warm the engine up (banks, Strudel, the controller) at the master × radio volume.
static func init_command(volume: float) -> String:
	return command(INIT, {"volume": volume})

static func seek_command(frac: float) -> String:
	return command(SEEK, {"frac": frac})

static func volume_command(value: float) -> String:
	return command(VOLUME, {"value": value})

## Whether the live stream may produce a new track (the free trial's daily generations).
static func gate_command(can_generate: bool) -> String:
	return command(GATE, {"canGenerate": can_generate})

static func play_track_command(seed: String, index: int) -> String:
	return command(PLAY_TRACK, {"seed": seed, "index": index})

## A saved favorite's frozen arrange() program (web BakedTrack: name, bpm, bars, info, program).
static func play_baked_command(track: Dictionary) -> String:
	return command(PLAY_BAKED, {"track": track})

## An event from the page, or {} unless the text is a JSON object with a string `event`.
static func parse_event(text: String) -> Dictionary:
	var json := JSON.new()
	if json.parse(text) != OK or not (json.data is Dictionary) or not ((json.data as Dictionary).get(EVENT) is String):
		return {}
	return json.data
