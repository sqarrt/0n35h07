class_name MapBackground extends Control
## The lobby's blurred map — port of web components/MapBackground (theme.css `.map-bg`): the selected map's preview
## covering the screen (object-fit: cover), blurred 5 px and dimmed to 70% (filter: blur(5px) brightness(0.7)), fading in
## and out over 0.7 s with the lobby (App showMap), and crossfading over 320 ms when the map changes (the old picture
## fades out on top of the new one). Each picture renders into two nested SubViewports once per map (the cover image,
## then the horizontal blur pass); the vertical pass draws on screen.

const BLUR_SHADER := preload("res://assets/shaders/image_blur.gdshader")
const BLUR_SIGMA := 5.0                        # filter: blur(5px) — σ in pixels
const BRIGHTNESS := 0.7                        # filter: brightness(0.7)
const FADE_S := 0.7                            # .map-bg transition: opacity 0.7s ease (App MAP_FADE_MS)
const SWITCH_FADE_S := 0.32                    # SWITCH_FADE_MS / map-snap-out 320ms ease
const HORIZONTAL := Vector2(1.0, 0.0)
const VERTICAL := Vector2(0.0, 1.0)
const HALF := 0.5
const LAYERS := 2                              # the current picture and the old one fading out over it

## One map's blurred picture.
class Layer extends Control:
	var map_id := ""
	var _image: SubViewport
	var _pass: SubViewport
	var _picture: TextureRect
	var _horizontal: ColorRect
	var _vertical: ColorRect

	func _init() -> void:
		mouse_filter = Control.MOUSE_FILTER_IGNORE
		_image = MapBackground.viewport("Image")
		_picture = TextureRect.new()
		_picture.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		_picture.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
		_image.add_child(_picture)
		_pass = MapBackground.viewport("BlurPass")
		_pass.add_child(_image)                    # nested: the image renders before the pass that reads it
		_horizontal = MapBackground.blur_rect(_image.get_texture(), MapBackground.HORIZONTAL, false)
		_pass.add_child(_horizontal)
		add_child(_pass)
		_vertical = MapBackground.blur_rect(_pass.get_texture(), MapBackground.VERTICAL, false)
		_vertical.name = "Picture"
		_vertical.modulate = Color(MapBackground.BRIGHTNESS, MapBackground.BRIGHTNESS, MapBackground.BRIGHTNESS)
		add_child(_vertical)

	func show_map(id: String, screen: Vector2) -> void:
		map_id = id
		_picture.texture = load(MapCatalog.preview_path(id))
		resize(screen)

	func resize(screen: Vector2) -> void:
		var pixels := Vector2i(screen.ceil())
		for viewport in [_image, _pass]:
			(viewport as SubViewport).size = pixels
			(viewport as SubViewport).render_target_update_mode = SubViewport.UPDATE_ONCE
		for rect in [_picture, _horizontal, _vertical]:
			(rect as Control).size = screen

	## CSS object-fit: cover — the preview scaled to fill the screen, centred, its overflow cropped.
	func cover_rect(screen: Vector2) -> Rect2:
		if _picture.texture == null:
			return Rect2(Vector2.ZERO, screen)
		var source := _picture.texture.get_size()
		var scale := maxf(screen.x / source.x, screen.y / source.y)
		return Rect2((screen - source * scale) * MapBackground.HALF, source * scale)

var _layers: Array[Layer] = []
var _current := 0
var _shown := false
var _opacity := 0.0
var _fade_from := 0.0
var _fade_to := 0.0
var _fade_t := 1.0
var _switch_t := 1.0

static func viewport(node_name: String) -> SubViewport:
	var sub := SubViewport.new()
	sub.name = node_name
	sub.transparent_bg = true
	sub.disable_3d = true
	sub.gui_disable_input = true
	sub.render_target_update_mode = SubViewport.UPDATE_ONCE
	return sub

static func blur_rect(source: Texture2D, direction: Vector2, premultiply: bool) -> ColorRect:
	var rect := ColorRect.new()
	rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var material := ShaderMaterial.new()
	material.shader = BLUR_SHADER
	material.set_shader_parameter("source", source)
	material.set_shader_parameter("direction", direction)
	material.set_shader_parameter("sigma", BLUR_SIGMA)
	material.set_shader_parameter("premultiply_source", premultiply)
	rect.material = material
	return rect

func _init() -> void:
	name = "MapBackground"
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	for i in LAYERS:
		var layer := Layer.new()
		layer.name = "Layer%d" % i
		add_child(layer)
		_layers.append(layer)
	_apply()

func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	resized.connect(func() -> void:
		for layer in _layers:
			if layer.map_id != "":
				layer.resize(size))

## The map to show (web lastMapId); a different one crossfades over the old picture.
func show_map(id: String) -> void:
	var old := _layers[_current]
	if id == old.map_id:
		return
	if old.map_id != "":
		_current = (_current + 1) % LAYERS
		move_child(old, get_child_count() - 1)   # the old picture fades out on top
		_switch_t = 0.0
	var layer := _layers[_current]
	layer.show_map(id, size)
	layer.modulate.a = 1.0
	_apply()

## Fade in with the lobby, out when it closes (web show = screen === 'lobby').
func set_shown(shown: bool) -> void:
	if shown == _shown:
		return
	_shown = shown
	_fade_from = _opacity
	_fade_to = 1.0 if shown else 0.0
	_fade_t = 0.0
	_apply()

func advance(delta: float) -> void:
	_fade_t = minf(1.0, _fade_t + delta / FADE_S)
	_switch_t = minf(1.0, _switch_t + delta / SWITCH_FADE_S)
	_apply()

func _process(delta: float) -> void:
	if _fade_t < 1.0 or _switch_t < 1.0:
		advance(delta)

func opacity() -> float:
	return _opacity

func current_map() -> String:
	return _layers[_current].map_id

## The old map still fading out after a switch, or "".
func fading_map() -> String:
	return _layers[(_current + 1) % LAYERS].map_id if _switch_t < 1.0 else ""

func fading_opacity() -> float:
	return _layers[(_current + 1) % LAYERS].modulate.a

func cover_rect() -> Rect2:
	return _layers[_current].cover_rect(size)

func _apply() -> void:
	_opacity = lerpf(_fade_from, _fade_to, CssTiming.cubic_bezier(_fade_t, CssTiming.EASE))
	modulate.a = _opacity
	visible = _opacity > 0.0
	_layers[_current].visible = true               # a layer hidden after its fade-out may be the current one again
	var fading := _layers[(_current + 1) % LAYERS]
	fading.visible = _switch_t < 1.0
	fading.modulate.a = 1.0 - CssTiming.cubic_bezier(_switch_t, CssTiming.EASE)
