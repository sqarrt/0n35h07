extends SceneTree
## Probe: what Windows reports for the display scale — the DPI, the scale, the screen and window sizes, and the root's
## visible rect with a content scale factor — windowed or fullscreen (pass --fullscreen). Writes
## test-results/probes/dpi/dpi-<mode>.json.

const OUTPUT_DIR := "res://test-results/probes/dpi"
const TRIAL_FACTOR := 1.5
const SETTLE_FRAMES := 5

func _initialize() -> void:
	for i in SETTLE_FRAMES:
		await process_frame
	var fullscreen := DisplayServer.window_get_mode() == DisplayServer.WINDOW_MODE_FULLSCREEN
	var facts := {
		"screen_dpi": DisplayServer.screen_get_dpi(),
		"screen_scale": DisplayServer.screen_get_scale(),
		"screen_max_scale": DisplayServer.screen_get_max_scale(),
		"screen_size": _pair(DisplayServer.screen_get_size()),
		"window_size": _pair(DisplayServer.window_get_size()),
		"root_size": _pair(root.size),
		"visible_rect": _pair(root.get_visible_rect().size),
		"content_scale_mode": root.content_scale_mode,
	}
	root.content_scale_factor = TRIAL_FACTOR
	await process_frame
	facts["visible_rect_at_1_5"] = _pair(root.get_visible_rect().size)
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(OUTPUT_DIR))
	var file := FileAccess.open("%s/dpi-%s.json" % [OUTPUT_DIR, "fullscreen" if fullscreen else "windowed"], FileAccess.WRITE)
	file.store_string(JSON.stringify(facts, "  "))
	file.close()
	quit()

func _pair(value: Vector2) -> Array:
	return [value.x, value.y]
