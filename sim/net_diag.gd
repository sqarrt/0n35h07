class_name NetDiag
## The network test harness, off unless the game is started with `--netdiag`. It exists so several windows can play
## each other without hands: the local player follows a fixed script instead of the keyboard, the session log goes to
## a file of this process's own (windows share one user:// and would otherwise write over each other), and the window
## saves a frame now and then as evidence.

const FLAG := "--netdiag"
const DIR := "user://netdiag"
const SHOT_INTERVAL_S := 5.0
const SIZE_FLAG := "--netdiag-size"        # our own spellings: the engine eats its `--resolution` / `--position`
const POSITION_FLAG := "--netdiag-at"      # before the game is up, so those never reach us
const DEFAULT_SIZE := Vector2i(1280, 720)

static func is_on(args: PackedStringArray) -> bool:
	return args.has(FLAG)

## The test always runs in a window (several of them side by side), whatever the project opens with, at the size and
## place the command line asks for — the engine's own window flags lose to the project setting, so the stand applies
## them itself.
static func apply_window(window: Window, args: PackedStringArray) -> void:
	window.mode = Window.MODE_WINDOWED
	window.size = _pair(args, SIZE_FLAG, "x", DEFAULT_SIZE)
	var placed := _pair(args, POSITION_FLAG, ",", Vector2i(-1, -1))
	if placed.x >= 0:
		window.position = placed

## A "<a><sep><b>" argument after `flag`, or `fallback`.
static func _pair(args: PackedStringArray, flag: String, separator: String, fallback: Vector2i) -> Vector2i:
	var at := args.find(flag)
	if at < 0 or at + 1 >= args.size():
		return fallback
	var parts := args[at + 1].split(separator)
	if parts.size() != 2 or not parts[0].is_valid_int() or not parts[1].is_valid_int():
		return fallback
	return Vector2i(int(parts[0]), int(parts[1]))

## Where this process writes its log and frames: one folder per window, named by its own id.
static func dir_for(pid: int) -> String:
	return "%s/%d" % [DIR, pid]
