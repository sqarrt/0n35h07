class_name DisplayStartup
## The Steam build's window at startup (web src-tauri tauri.conf.json: `fullscreen: true`) with its interface at the
## Windows scale, like the WebView's CSS px (UiScale). The window is BORN fullscreen (project display/window/size/mode),
## so the player never sees a windowed frame first; this only adds the scale. A -s tool (captures, tests) owns its
## window instead: it sizes and scales it itself, so startup hands it back the windowed mode the project setting took
## away. A headless run has no screen to fill.

const TOOL_FLAG := "-s"

static func start(window: Window, args: PackedStringArray, headless: bool, dpi: int) -> void:
	if is_tool_run(args):
		window.mode = Window.MODE_WINDOWED
		return
	window.content_scale_factor = UiScale.for_dpi(dpi)
	if not headless:
		window.mode = Window.MODE_FULLSCREEN

## A -s tool run (captures, tests): it owns the window and must not touch the player's Steam state. (Not `is_tool`:
## called on the class, that name resolves to Script.is_tool().)
static func is_tool_run(args: PackedStringArray) -> bool:
	return args.has(TOOL_FLAG)
