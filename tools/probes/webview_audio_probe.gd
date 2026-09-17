extends SceneTree
## Probe (2026-09-15): godot_wry in Godot 4.7 on Windows — does the WebView load a res:// page, does its AudioContext
## run without a user gesture, keep its clock running while the WebView is hidden or a 1×1 box off screen, and do
## ipc messages cross both ways? Writes every message with its phase to test-results/probes/webview/<variant>.json.
##   Godot.exe --path . --resolution 640x360 -s tools/probes/webview_audio_probe.gd -- [autoplay-arg | autoplay-prop]
## `autoplay-arg` sets WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--autoplay-policy=no-user-gesture-required first (wry
## passes its own browser arguments: no effect); `autoplay-prop` sets the WebView's own `autoplay` property (wry
## with_autoplay) before the view is created.

## Under res://localhost/: godot_wry serves res://<dir>/ as http://res.<dir>/, and only *.localhost is a secure context
## (AudioWorklet); page=res://<other dir>/... reproduces the insecure origin.
const PAGE := "res://localhost/probes/webview_audio_probe.html"
const OUT_DIR := "res://test-results/probes/webview"
const PHASE_S := 3.0
const PHASES := ["visible", "hidden", "offscreen-1px", "visible-again"]
const VISIBLE_BOX := Rect2(0.0, 0.0, 320.0, 180.0)
const OFFSCREEN_BOX := Rect2(-10.0, -10.0, 1.0, 1.0)
const AUTOPLAY_FLAG := "autoplay-arg"
const AUTOPLAY_PROPERTY_FLAG := "autoplay-prop"
const PAGE_ARG := "page="
const BROWSER_ARGS_ENV := "WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS"
const AUTOPLAY_ARGS := "--autoplay-policy=no-user-gesture-required"

var _messages: Array = []
var _phase := ""

func _initialize() -> void:
	var args := OS.get_cmdline_user_args()
	var variant := "default"
	if args.has(AUTOPLAY_FLAG):
		OS.set_environment(BROWSER_ARGS_ENV, AUTOPLAY_ARGS)
		variant = "autoplay"
	if not ClassDB.class_exists("WebView"):
		print("webview probe: the WebView class is not registered")
		quit(1)
		return
	var view := ClassDB.instantiate("WebView") as Control
	if args.has(AUTOPLAY_PROPERTY_FLAG):
		view.set("autoplay", true)
		variant = "autoplay-property"
	var page := PAGE
	for arg in args:
		if arg.begins_with(PAGE_ARG):   # page=res://localhost/...: godot_wry serves it from http://res.localhost
			page = arg.trim_prefix(PAGE_ARG)
			variant += "-" + page.get_base_dir().get_file()
	view.set("url", page)
	view.position = VISIBLE_BOX.position
	view.size = VISIBLE_BOX.size
	view.connect("ipc_message", func(message: String) -> void: _messages.append({"phase": _phase, "message": message}))
	root.add_child(view)
	_run(view, variant)

func _run(view: Control, variant: String) -> void:
	for phase in PHASES:
		_phase = phase
		match phase:
			"visible", "visible-again":
				view.visible = true
				view.position = VISIBLE_BOX.position
				view.size = VISIBLE_BOX.size
				view.call("post_message", "ping from godot (%s)" % phase)
			"hidden":
				view.visible = false
			"offscreen-1px":
				view.visible = true
				view.position = OFFSCREEN_BOX.position
				view.size = OFFSCREEN_BOX.size
		await create_timer(PHASE_S).timeout
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(OUT_DIR))
	var file := FileAccess.open("%s/%s.json" % [OUT_DIR, variant], FileAccess.WRITE)
	file.store_string(JSON.stringify({"variant": variant, "messages": _messages}, "  "))
	file.close()
	print("webview probe: %d messages -> %s/%s.json" % [_messages.size(), OUT_DIR, variant])
	quit()
