extends SceneTree
## Probe: what a -s tool sees at startup — whether the autoloads exist, the command-line arguments, and how a content
## scale factor shows in the root's final transform, size and visible rect. Writes
## test-results/probes/dpi/runtime-<mode>.json.

const OUTPUT_DIR := "res://test-results/probes/dpi"
const TRIAL_FACTOR := 1.5
const SETTLE_FRAMES := 5

func _initialize() -> void:
	var early := {"game_autoload_at_initialize": root.get_node_or_null("Game") != null}
	for i in SETTLE_FRAMES:
		await process_frame
	var fullscreen := DisplayServer.window_get_mode() == DisplayServer.WINDOW_MODE_FULLSCREEN
	root.content_scale_factor = TRIAL_FACTOR
	await process_frame
	var facts := early.merged({
		"game_autoload_later": root.get_node_or_null("Game") != null,
		"cmdline_args": OS.get_cmdline_args(),
		"cmdline_user_args": OS.get_cmdline_user_args(),
		"final_transform_scale": root.get_final_transform().get_scale().x,
		"root_size": [root.size.x, root.size.y],
		"visible_rect": [root.get_visible_rect().size.x, root.get_visible_rect().size.y],
		"window_mode": DisplayServer.window_get_mode(),
		"project_window_mode": ProjectSettings.get_setting("display/window/size/mode"),
	})
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(OUTPUT_DIR))
	var file := FileAccess.open("%s/runtime-%s.json" % [OUTPUT_DIR, "fullscreen" if fullscreen else "windowed"],
		FileAccess.WRITE)
	file.store_string(JSON.stringify(facts, "  "))
	file.close()
	quit()
