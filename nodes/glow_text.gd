class_name GlowText extends Control
## Text with CSS text-shadow glows that really blur. Godot Label shadows stay sharp, so each shadow is a separable
## Gaussian (CssShadow: sigma = blur / 2) of the glyph mask: the mask renders into a SubViewport, a second SubViewport
## blurs it horizontally, and an on-screen layer blurs it vertically in the shadow colour. The first CSS shadow paints
## on top and the sharp text above all of them. Viewports nest (the mask inside the first pass, each pass inside the
## next) so every viewport renders before the one sampling it. Lays out exactly like its text.

const BLUR_SHADER := preload("res://assets/shaders/glow_blur.gdshader")
const HORIZONTAL := Vector2(1.0, 0.0)
const VERTICAL := Vector2(0.0, 1.0)

var _label: Label
var _mask_label: Label
var _mask: SubViewport
var _passes: Array[SubViewport] = []
var _pass_rects: Array[TextureRect] = []
var _layers: Array[TextureRect] = []
var _offsets: Array[Vector2] = []
var _pad := 0

func _init() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	_label = _new_label("Text")
	_label.minimum_size_changed.connect(_resize)   # the glyph box changes once theme fonts apply
	add_child(_label)
	_mask_label = _new_label("MaskText")
	_mask_label.add_theme_color_override("font_color", Color.WHITE)

## Font, size and text colour for the text and its glyph mask.
func configure(font: Font, font_size: int, color: Color) -> void:
	for l in [_label, _mask_label]:
		l.add_theme_font_override("font", font)
		l.add_theme_font_size_override("font_size", font_size)
	set_color(color)
	_resize()

func set_text(text: String) -> void:
	if text == _label.text:
		return
	_label.text = text
	_mask_label.text = text
	_resize()

func set_color(color: Color) -> void:
	_label.add_theme_color_override("font_color", color)

## CssShadow dictionaries, first on top. The same count only updates the glows; the padding never shrinks, so
## animated glows don't reallocate their viewports.
func set_shadows(shadows: Array) -> void:
	if shadows.size() != _layers.size():
		_rebuild(shadows.size())
	_pad = maxi(_pad, CssShadow.padding(shadows))
	for i in shadows.size():
		var shadow: Dictionary = shadows[i]
		var sigma := CssShadow.sigma(shadow["blur"])
		(_pass_rects[i].material as ShaderMaterial).set_shader_parameter("sigma", sigma)
		var layer := _layers[i].material as ShaderMaterial
		layer.set_shader_parameter("sigma", sigma)
		layer.set_shader_parameter("tint", shadow["color"])
		_offsets[i] = shadow["offset"]
	_resize()

func _notification(what: int) -> void:
	# The mask label lives outside the tree until a shadow needs it; free it with the node so it never leaks.
	if what == NOTIFICATION_PREDELETE and is_instance_valid(_mask_label) and _mask_label.get_parent() == null:
		_mask_label.free()

func label() -> Label:
	return _label

func mask_label() -> Label:
	return _mask_label

func layers() -> Array[TextureRect]:
	return _layers

func layer_count() -> int:
	return _layers.size()

func padding() -> int:
	return _pad

func _rebuild(count: int) -> void:
	if _mask != null:
		_mask.remove_child(_mask_label)
	if not _passes.is_empty():
		var outer: SubViewport = _passes.back()
		remove_child(outer)
		outer.free()   # out of the tree: frees the nested chain with it right away
	for layer in _layers:
		remove_child(layer)
		layer.free()
	_mask = null
	_passes.clear()
	_pass_rects.clear()
	_layers.clear()
	_offsets.clear()
	if count == 0:
		return
	_mask = _viewport("Mask")
	_mask.add_child(_mask_label)
	var inner: SubViewport = _mask
	for i in count:
		var blur_pass := _viewport("BlurPass%d" % i)
		blur_pass.add_child(inner)
		var rect := _blur_rect(_mask.get_texture(), HORIZONTAL)
		blur_pass.add_child(rect)
		_passes.append(blur_pass)
		_pass_rects.append(rect)
		inner = blur_pass
	add_child(inner)
	_layers.resize(count)
	_offsets.resize(count)
	for i in range(count - 1, -1, -1):
		var layer := _blur_rect(_passes[i].get_texture(), VERTICAL)
		layer.name = "Glow%d" % i
		add_child(layer)
		_layers[i] = layer
	move_child(_label, get_child_count() - 1)

func _resize() -> void:
	var text_size := _label.get_minimum_size()
	custom_minimum_size = text_size
	_label.position = Vector2.ZERO
	_label.size = text_size
	if _mask == null:
		return
	var viewport_size := Vector2i(text_size.ceil()) + Vector2i.ONE * 2 * _pad
	_mask.size = viewport_size
	_mask_label.position = Vector2.ONE * _pad
	_mask_label.size = text_size
	for i in _passes.size():
		_passes[i].size = viewport_size
		_pass_rects[i].size = Vector2(viewport_size)
		_layers[i].position = -Vector2.ONE * _pad + _offsets[i]
		_layers[i].size = Vector2(viewport_size)

func _new_label(node_name: String) -> Label:
	var l := Label.new()
	l.name = node_name
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return l

func _viewport(node_name: String) -> SubViewport:
	var viewport := SubViewport.new()
	viewport.name = node_name
	viewport.transparent_bg = true
	viewport.disable_3d = true
	viewport.gui_disable_input = true
	viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	return viewport

func _blur_rect(source: Texture2D, direction: Vector2) -> TextureRect:
	var rect := TextureRect.new()
	rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
	rect.texture = source
	rect.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	rect.stretch_mode = TextureRect.STRETCH_SCALE
	rect.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	var material := ShaderMaterial.new()
	material.shader = BLUR_SHADER
	material.set_shader_parameter("direction", direction)
	rect.material = material
	return rect
