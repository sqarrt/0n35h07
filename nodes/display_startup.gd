class_name DisplayStartup
## The Steam build's window at startup (web src-tauri tauri.conf.json: `fullscreen: true`) with its interface at the
## Windows scale, like the WebView's CSS px (UiScale). The window is BORN fullscreen (project display/window/size/mode),
## so the player never sees a windowed frame first; this only adds the scale. A -s tool (captures, tests) owns its
## window instead: it sizes and scales it itself, so startup hands it back the windowed mode the project setting took
## away. A headless run has no screen to fill.

const TOOL_FLAG := "-s"

## The window is born fullscreen from the project setting (display/window/size/mode), and the engine's own
## `--windowed` / `--resolution` / `--position` override that before the game starts — so all this adds is the scale.
## A -s tool (captures, tests) owns its window instead and gets the windowed mode back.
static func start(window: Window, args: PackedStringArray, dpi: int) -> void:
	if is_tool_run(args):
		window.mode = Window.MODE_WINDOWED
		return
	window.content_scale_factor = UiScale.for_dpi(dpi)
	if NetDiag.is_on(args):
		NetDiag.apply_window(window, args)   # the network test needs its windows side by side

## A -s tool run (captures, tests): it owns the window and must not touch the player's Steam state. (Not `is_tool`:
## called on the class, that name resolves to Script.is_tool().)
static func is_tool_run(args: PackedStringArray) -> bool:
	return args.has(TOOL_FLAG)
