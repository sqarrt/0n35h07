extends SceneTree
## Probe (2026-09-15): the godot_wry WebView's defaults that decide whether it covers the game — full_window_size,
## transparent, focused_when_created, forward_input_events — as a freshly instantiated view reports them.
##   Godot.exe --path . --log-file <log> -s tools/probes/webview_defaults_probe.gd

const CLASS_NAME := "WebView"
const PROPERTIES := ["full_window_size", "transparent", "focused_when_created", "forward_input_events", "background_color"]

func _initialize() -> void:
	if not ClassDB.class_exists(CLASS_NAME):
		print("webview defaults probe: no WebView class")
		quit(1)
		return
	var view: Object = ClassDB.instantiate(CLASS_NAME)
	for property in PROPERTIES:
		print("webview defaults probe: %s = %s" % [property, view.get(property)])
	view.free()
	quit()
