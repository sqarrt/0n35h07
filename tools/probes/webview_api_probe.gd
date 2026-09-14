extends SceneTree
## Probe (2026-09-15): the godot_wry WebView class as registered — its own properties, methods and signals.

const CLASS_NAME := "WebView"

func _initialize() -> void:
	if not ClassDB.class_exists(CLASS_NAME):
		print("webview api: class missing")
		quit(1)
		return
	for property in ClassDB.class_get_property_list(CLASS_NAME, true):
		print("property: %s (type %d)" % [property["name"], property["type"]])
	for method in ClassDB.class_get_method_list(CLASS_NAME, true):
		print("method: %s(%s)" % [method["name"], ", ".join(method["args"].map(func(a: Dictionary) -> String: return a["name"]))])
	for sig in ClassDB.class_get_signal_list(CLASS_NAME, true):
		print("signal: %s" % sig["name"])
	quit()
