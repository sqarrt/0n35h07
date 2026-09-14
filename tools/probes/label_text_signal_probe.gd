extends SceneTree
## Probe (2026-09-15): how a Label subclass can learn that its text changed — signals, `_set`, the minimum size with
## visible characters cut before shaping.

class Watched extends Label:
	var sets := 0
	var draws := 0
	func _set(property: StringName, _value: Variant) -> bool:
		if property == &"text":
			sets += 1
		return false
	func _notification(what: int) -> void:
		if what == NOTIFICATION_DRAW:
			draws += 1

func _initialize() -> void:
	var signals := []
	for s in ClassDB.class_get_signal_list("Label", true):
		signals.append(s["name"])
	print("Label signals: ", signals)
	var label := Watched.new()
	label.text = "HELLO"
	label.add_theme_font_size_override("font_size", 16)
	root.add_child(label)
	var emitted := [0]
	label.minimum_size_changed.connect(func(): emitted[0] += 1)
	await process_frame
	print("after-shaping min: ", label.get_minimum_size())
	label.visible_characters = 0
	label.visible_characters_behavior = TextServer.VC_CHARS_BEFORE_SHAPING
	await process_frame
	print("before-shaping visible 0 min: ", label.get_minimum_size(), " emitted ", emitted[0])
	emitted[0] = 0
	var typed: Label = label
	typed.text = "HELLO WORLD LONGER"
	print("typed set -> _set calls ", label.sets)
	label.set("text", "HELLO AGAIN")
	print("Object.set -> _set calls ", label.sets)
	label.draws = 0
	await process_frame
	await process_frame
	print("after text change: emitted ", emitted[0], " draws ", label.draws, " min ", label.get_minimum_size())
	label.text = ""
	await process_frame
	print("empty text min: ", label.get_minimum_size())
	quit()
