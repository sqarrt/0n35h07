class_name CssGlow extends RefCounted
## Real blurred CSS shadows (text-shadow glows) of whatever a mask control draws in white: the mask renders into a
## SubViewport, one SubViewport per shadow blurs it horizontally (a separable Gaussian, CssShadow: sigma = blur / 2) and
## a layer on the host blurs it vertically in the shadow colour, the first CSS shadow on top. Viewports nest (the mask
## inside the first pass, each pass inside the next) so every viewport renders before the one sampling it. The host owns
## the viewports and layers as children and draws its sharp content above them.

const BLUR_SHADER := preload("res://assets/shaders/glow_blur.gdshader")
const HORIZONTAL := Vector2(1.0, 0.0)
const VERTICAL := Vector2(0.0, 1.0)

var _host: Control
var _content: Control
var _mask: SubViewport
var _passes: Array[SubViewport] = []
var _pass_rects: Array[TextureRect] = []
var _layers: Array[TextureRect] = []
var _offsets: Array[Vector2] = []
var _pad := 0

## `content` draws the mask (white glyphs); it lives outside the tree until a shadow needs it.
func _init(host: Control, content: Control) -> void:
	_host = host
	_content = content

## CssShadow dictionaries, first on top. The same count only updates the glows; the padding never shrinks, so animated
## glows don't reallocate their viewports. Call resize() after.
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

## Lay the mask and every pass out around content of `content_size` at the host's origin.
func resize(content_size: Vector2) -> void:
	if _mask == null:
		return
	var viewport_size := Vector2i(content_size.ceil()) + Vector2i.ONE * 2 * _pad
	_mask.size = viewport_size
	_content.position = Vector2.ONE * _pad
	_content.size = content_size
	for i in _passes.size():
		_passes[i].size = viewport_size
		_pass_rects[i].size = Vector2(viewport_size)
		_layers[i].position = -Vector2.ONE * _pad + _offsets[i]
		_layers[i].size = Vector2(viewport_size)

func layers() -> Array[TextureRect]:
	return _layers

func layer_count() -> int:
	return _layers.size()

func padding() -> int:
	return _pad

## The mask content is freed with the host when no shadow ever adopted it (call from the host's PREDELETE).
func release() -> void:
	if is_instance_valid(_content) and _content.get_parent() == null:
		_content.free()

func _rebuild(count: int) -> void:
	if _mask != null:
		_mask.remove_child(_content)
	if not _passes.is_empty():
		var outer: SubViewport = _passes.back()
		_host.remove_child(outer)
		outer.free()   # out of the tree: frees the nested chain with it right away
	for layer in _layers:
		_host.remove_child(layer)
		layer.free()
	_mask = null
	_passes.clear()
	_pass_rects.clear()
	_layers.clear()
	_offsets.clear()
	if count == 0:
		return
	_mask = _viewport("Mask")
	_mask.add_child(_content)
	var inner: SubViewport = _mask
	for i in count:
		var blur_pass := _viewport("BlurPass%d" % i)
		blur_pass.add_child(inner)
		var rect := _blur_rect(_mask.get_texture(), HORIZONTAL)
		blur_pass.add_child(rect)
		_passes.append(blur_pass)
		_pass_rects.append(rect)
		inner = blur_pass
	_host.add_child(inner)
	_layers.resize(count)
	_offsets.resize(count)
	for i in range(count - 1, -1, -1):
		var layer := _blur_rect(_passes[i].get_texture(), VERTICAL)
		layer.name = "Glow%d" % i
		_host.add_child(layer)
		_layers[i] = layer

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
