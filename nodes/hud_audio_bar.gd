class_name HudAudioBar extends Control
## The HUD sound visualiser — port of web components/AudioBar.tsx: a thin #4af line jittering with the spectrum at the
## bottom centre (46% of the screen width, 42 px tall, 35 px above the bottom edge), bass in the middle and highs toward
## both ends, under the SVG filter drop-shadow(0 0 4px #4af) — Chrome blurs a drop-shadow of N px with sigma N. The glow
## is the line's alpha blurred through a SubViewport pass (the HudOverheatVignette pipeline), drawn under the line.

const BLUR_SHADER := preload("res://assets/shaders/glow_blur.gdshader")
const KERNEL_SIGMAS := 3.0                  # glow_blur reaches three sigmas
const HORIZONTAL := Vector2(1.0, 0.0)
const VERTICAL := Vector2(0.0, 1.0)
const HALF := 0.5

## The polyline with round caps at its two ends (SVG stroke-linecap round), offset to where the bar box sits. Round
## joins add nothing visible on this nearly straight line, and discs at all 79 vertices would thicken the stroke well
## past the web's 2.5 px coverage (measured with tools/audio_bar_probe.gd against the web capture).
class LineCanvas extends Control:
	var points := PackedVector2Array()
	var offset := Vector2.ZERO

	func _draw() -> void:
		if points.size() < 2:
			return
		var shifted := PackedVector2Array()
		for point in points:
			shifted.append(point + offset)
		draw_polyline(shifted, AudioBarModel.COLOR, AudioBarModel.STROKE_PX, true)
		for end in [shifted[0], shifted[shifted.size() - 1]]:
			draw_circle(end, AudioBarModel.STROKE_PX * HudAudioBar.HALF, AudioBarModel.COLOR, true, -1.0, true)

var model := AudioBarModel.new()

var _mask: SubViewport
var _pass: SubViewport
var _mask_canvas: LineCanvas
var _glow: TextureRect
var _pass_rect: TextureRect
var _line: LineCanvas

func _ready() -> void:
	name = "AudioBar"
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_mask = _viewport("LineMask")
	_mask_canvas = LineCanvas.new()
	_mask.add_child(_mask_canvas)
	_pass = _viewport("GlowPass")
	_pass.add_child(_mask)
	_pass_rect = _blur(_mask.get_texture(), HORIZONTAL, Color.WHITE)
	_pass.add_child(_pass_rect)
	add_child(_pass)
	_glow = _blur(_pass.get_texture(), VERTICAL, AudioBarModel.COLOR)
	_glow.name = "Glow"
	add_child(_glow)
	_line = LineCanvas.new()
	_line.name = "Line"
	_line.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_line.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(_line)
	_layout()

## One animation frame with the combined band levels (web AudioBar's requestAnimationFrame tick).
func tick(bands: PackedFloat32Array) -> void:
	model.step(bands)
	_refresh()

## A fresh component (web remounts AudioBar with zeroed levels whenever it reappears).
func reset() -> void:
	model = AudioBarModel.new()
	_refresh()

func bar_size() -> Vector2:
	return Vector2(size.x * AudioBarModel.WIDTH_SHARE, AudioBarModel.HEIGHT_PX)

## Top-left of the bar box: centred (left 50% + translateX(-50%)) and BOTTOM_PX above the bottom edge.
func bar_origin() -> Vector2:
	var box := bar_size()
	return Vector2((size.x - box.x) * HALF, size.y - AudioBarModel.BOTTOM_PX - box.y)

func line_points() -> PackedVector2Array:
	return _line.points

func _notification(what: int) -> void:
	if what == NOTIFICATION_RESIZED and _line != null:
		_layout()

func _padding() -> float:
	return ceilf(KERNEL_SIGMAS * AudioBarModel.GLOW_SIGMA_PX + AudioBarModel.STROKE_PX)

func _layout() -> void:
	var pad := _padding()
	var texture_size := Vector2i((bar_size() + Vector2.ONE * 2.0 * pad).ceil())
	if texture_size.x <= 0 or texture_size.y <= 0:
		return
	_mask.size = texture_size
	_pass.size = texture_size
	_mask_canvas.size = Vector2(texture_size)
	_pass_rect.size = Vector2(texture_size)
	_glow.position = bar_origin() - Vector2.ONE * pad
	_glow.size = Vector2(texture_size)
	_refresh()

func _refresh() -> void:
	var points := model.points(bar_size())
	_mask_canvas.points = points
	_mask_canvas.offset = Vector2.ONE * _padding()
	_mask_canvas.queue_redraw()
	_line.points = points
	_line.offset = bar_origin()
	_line.queue_redraw()

func _viewport(node_name: String) -> SubViewport:
	var viewport := SubViewport.new()
	viewport.name = node_name
	viewport.transparent_bg = true
	viewport.disable_3d = true
	viewport.gui_disable_input = true
	viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	return viewport

func _blur(source: Texture2D, direction: Vector2, tint: Color) -> TextureRect:
	var rect := TextureRect.new()
	rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
	rect.texture = source
	rect.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	rect.stretch_mode = TextureRect.STRETCH_SCALE
	rect.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	var material := ShaderMaterial.new()
	material.shader = BLUR_SHADER
	material.set_shader_parameter("direction", direction)
	material.set_shader_parameter("sigma", AudioBarModel.GLOW_SIGMA_PX)
	material.set_shader_parameter("tint", tint)
	rect.material = material
	return rect
