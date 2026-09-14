class_name DisplayStartup
## The Steam build's window at startup (web src-tauri tauri.conf.json: `fullscreen: true`) with its interface at the
## Windows scale, like the WebView's CSS px (UiScale). A -s tool (captures, tests) owns its window: it sets the scale it
## captures at, and the autoloads get ready after its _initialize, so startup leaves it alone. A headless run has no
## screen to fill.

const TOOL_FLAG := "-s"

static func start(window: Window, args: PackedStringArray, headless: bool, dpi: int) -> void:
	if args.has(TOOL_FLAG):
		return
	window.content_scale_factor = UiScale.for_dpi(dpi)
	if not headless:
		window.mode = Window.MODE_FULLSCREEN
