extends SceneTree
## Dev probe: CSS opacity fades a button as one composited group (the label stays dark over its fill); Godot's modulate
## fades every draw call. Renders a disabled primary UiButton at half opacity three ways over a flat background — plain
## modulate, clip_children with modulate, and inside a CanvasGroup — and prints the box and label pixels next to the
## group-opacity expectation.
##   <godot> --resolution 1280x720 -s tools/group_opacity_probe.gd

const BACKGROUND := Color8(16, 16, 16)
const OPACITY := 0.5
const ORIGINS := [Vector2(100.0, 100.0), Vector2(100.0, 250.0), Vector2(100.0, 400.0)]
const VARIANTS := ["modulate", "clip_children", "canvas_group"]
const BOX_SAMPLE := Vector2(10.0, 10.0)
const SETTLE_FRAMES := 4
const INK_SCAN := Rect2(60.0, 12.0, 100.0, 20.0)
const OUT := "res://test-results/probes/ui/group_opacity_probe.png"

var _frames := 0
var _buttons: Array[UiButton] = []

func _initialize() -> void:
	var background := ColorRect.new()
	background.color = BACKGROUND
	background.size = Vector2(1280.0, 720.0)
	root.add_child(background)
	for i in VARIANTS.size():
		var button := UiButton.new("RESUME", UiButton.PRIMARY, false)
		button.disabled_opacity = OPACITY
		button.set_enabled(false)
		if VARIANTS[i] == "canvas_group":
			var group := CanvasGroup.new()
			group.position = ORIGINS[i]
			group.self_modulate.a = OPACITY
			button.modulate.a = 1.0
			root.add_child(group)
			group.add_child(button)
		else:
			button.position = ORIGINS[i]
			if VARIANTS[i] == "clip_children":
				button.clip_children = CanvasItem.CLIP_CHILDREN_AND_DRAW
			root.add_child(button)
		_buttons.append(button)

func _process(_delta: float) -> bool:
	_frames += 1
	if _frames == SETTLE_FRAMES:
		_capture()
	return false

func _capture() -> void:
	await RenderingServer.frame_post_draw
	var image := root.get_texture().get_image()
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(OUT.get_base_dir()))
	image.save_png(OUT)
	var expected_box := UiTokens.ACCENT_FILL.lerp(BACKGROUND, 1.0 - OPACITY)
	var expected_ink := UiTokens.INK.lerp(BACKGROUND, 1.0 - OPACITY)
	print("GROUP expected box %s  expected darkest label %s" % [_rgb(expected_box), _rgb(expected_ink)])
	for i in VARIANTS.size():
		var origin: Vector2 = ORIGINS[i]
		var box := image.get_pixelv(Vector2i(origin + BOX_SAMPLE))
		var darkest := Color.WHITE
		for y in range(int(INK_SCAN.position.y), int(INK_SCAN.end.y)):
			for x in range(int(INK_SCAN.position.x), int(INK_SCAN.end.x)):
				var c := image.get_pixel(int(origin.x) + x, int(origin.y) + y)
				if c.b < darkest.b:
					darkest = c
		print("GROUP %-13s box %s  darkest label %s" % [VARIANTS[i], _rgb(box), _rgb(darkest)])
	quit()

func _rgb(c: Color) -> String:
	return "(%d, %d, %d)" % [c.r8, c.g8, c.b8]
