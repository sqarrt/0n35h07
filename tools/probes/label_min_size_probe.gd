extends SceneTree
## Probe: whether a script subclass of Label / Button can size itself — `_get_minimum_size` against
## `custom_minimum_size` — and whether its `_draw` runs after the native text (so a custom text drawing can sit on top).
## Prints MIN_SIZE_PROBE lines.

const SCRIPTED := Vector2(321, 45)

class SizedLabel extends Label:
	var drew_after_native := false
	func _get_minimum_size() -> Vector2:
		return MinSizes.SCRIPTED
	func _draw() -> void:
		drew_after_native = true

class SizedButton extends Button:
	func _get_minimum_size() -> Vector2:
		return MinSizes.SCRIPTED

class MinSizes:
	const SCRIPTED := Vector2(321, 45)

func _initialize() -> void:
	var label := SizedLabel.new()
	label.text = "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW"
	root.add_child(label)
	var button := SizedButton.new()
	button.text = "W"
	root.add_child(button)
	var custom := Label.new()
	custom.text = "W"
	custom.custom_minimum_size = SCRIPTED
	root.add_child(custom)
	await process_frame
	await process_frame
	print("MIN_SIZE_PROBE label_scripted=%s label_combined=%s" % [label.get_minimum_size(), label.get_combined_minimum_size()])
	print("MIN_SIZE_PROBE button_scripted=%s button_combined=%s" % [button.get_minimum_size(), button.get_combined_minimum_size()])
	print("MIN_SIZE_PROBE label_custom_combined=%s label_draw_called=%s" % [custom.get_combined_minimum_size(),
		label.drew_after_native])
	quit()
