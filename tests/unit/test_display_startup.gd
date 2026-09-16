extends GutTest
## DisplayStartup: the Steam build's window (web src-tauri tauri.conf.json: fullscreen) with the interface at the Windows
## scale. A -s tool (captures, tests) owns its window — the tool sets the scale it captures at, so startup leaves it
## alone — and a headless run keeps its window.

const EPS := 0.001
const TOOL_ARGS := ["-s", "tools/screenshot.gd"]
const SCALED_DPI := 144

func _window() -> Window:
	var window := Window.new()
	autofree(window)
	return window

func test_the_game_fills_the_screen_at_the_windows_scale() -> void:
	var window := _window()
	DisplayStartup.start(window, PackedStringArray(), false, SCALED_DPI)
	assert_almost_eq(window.content_scale_factor, 1.5, EPS, "CSS px = physical px / 1.5")
	assert_eq(window.mode, Window.MODE_FULLSCREEN, "like the Tauri window")

func test_a_tool_keeps_its_window_and_scale() -> void:
	var window := _window()
	window.mode = Window.MODE_FULLSCREEN   # the project setting opens every window fullscreen
	DisplayStartup.start(window, PackedStringArray(TOOL_ARGS), false, SCALED_DPI)
	assert_almost_eq(window.content_scale_factor, 1.0, EPS, "the capture tool sets its own scale")
	assert_eq(window.mode, Window.MODE_WINDOWED, "a capture window is not fullscreen")

func test_a_tool_run_is_recognized_from_outside() -> void:
	assert_true(DisplayStartup.is_tool_run(PackedStringArray(TOOL_ARGS)), "the autoload asks before touching Steam")
	assert_false(DisplayStartup.is_tool_run(PackedStringArray()))

func test_a_headless_run_keeps_its_window() -> void:
	var window := _window()
	DisplayStartup.start(window, PackedStringArray(), true, SCALED_DPI)
	assert_almost_eq(window.content_scale_factor, 1.5, EPS)
	assert_eq(window.mode, Window.MODE_WINDOWED, "no screen to fill")

func test_the_window_is_born_fullscreen() -> void:
	# Switching to fullscreen from _ready showed a windowed frame first; the project setting opens it that way.
	assert_eq(int(ProjectSettings.get_setting("display/window/size/mode")), Window.MODE_FULLSCREEN)

func test_the_game_opens_on_its_own_background_not_the_engine_logo() -> void:
	# web: the page paints --bg and goes straight to the warning splash; the engine's own logo has no place there.
	assert_false(bool(ProjectSettings.get_setting("application/boot_splash/show_image")))
	assert_eq(Color(ProjectSettings.get_setting("application/boot_splash/bg_color")), UiTokens.BG,
		"the first frame is the game's background")
