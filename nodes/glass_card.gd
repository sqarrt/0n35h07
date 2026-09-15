class_name GlassCard extends Control
## The "Apple Glass" surface — port of web components/glass.ts glassCard, shared by the Radio player and the invite
## toast: the screen copied before each half of the 24 px backdrop blur (the second half reads the first through a
## fresh copy), then the frosted surface — the 55% fill over a 160% saturation of what shows through, the 1 px hairline
## border on a 14 px radius, the inset top highlight, a half-pixel outer ring and the 0 8px 40px shadow. The owner adds
## its content after the card and lays it out with set_box.

const BLUR_PASS_SHADER := preload("res://assets/shaders/glass_blur_pass.gdshader")
const SURFACE_SHADER := preload("res://assets/shaders/glass_surface.gdshader")
const RADIUS := 14.0
const BORDER_PX := 1.0
const FILL := Color(10.0 / 255.0, 15.0 / 255.0, 20.0 / 255.0, 0.55)
const BORDER := Color(1.0, 1.0, 1.0, 0.12)
const HIGHLIGHT := Color(1.0, 1.0, 1.0, 0.18)        # inset 0 1px 0
const HIGHLIGHT_PX := 1.0
const RING := Color(1.0, 1.0, 1.0, 0.06)             # 0 0 0 0.5px
const RING_PX := 0.5
const SHADOW := Color(0.0, 0.0, 0.0, 0.5)            # 0 8px 40px
const SHADOW_OFFSET := Vector2(0.0, 8.0)
const SHADOW_BLUR := 40.0
const SHADOW_SIGMA_SHARE := 0.5                      # a box-shadow blur is 2σ
const BACKDROP_SIGMA := 24.0                         # backdrop-filter blur(24px): σ 24 px
const SATURATION := 1.6                              # saturate(160%)
const KERNEL_SIGMAS := 3.0

var _blur: ColorRect
var _surface: ColorRect
var _shadow_offset := SHADOW_OFFSET
var _shadow_blur := SHADOW_BLUR

func _init() -> void:
	name = "Glass"
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_screen_copy())                        # what was drawn so far
	_blur = _shader_rect("BackdropBlur", BLUR_PASS_SHADER)
	add_child(_screen_copy())                        # with the horizontal half of the blur in the box
	_surface = _shader_rect("Surface", SURFACE_SHADER)

func blur() -> ColorRect:
	return _blur

func surface() -> ColorRect:
	return _surface

## Another outer shadow and ring for the same glass (the radio windows, RadioExplorer.css .rexp: 0 18px 60px, no ring;
## the library's context menu: 0 14px 44px at 60%).
func set_shadow(offset: Vector2, blur: float, ring_px := RING_PX, color := SHADOW) -> void:
	_shadow_offset = offset
	_shadow_blur = blur
	var material := _surface.material as ShaderMaterial
	material.set_shader_parameter("shadow_color", color)
	material.set_shader_parameter("shadow_offset_px", offset)
	material.set_shader_parameter("shadow_sigma", blur * SHADOW_SIGMA_SHARE)
	material.set_shader_parameter("ring_px", ring_px)
	set_box(size)

## Another glass (RadioExplorer.css .rexp-ctx: a denser fill, a softer top highlight, 12 px corners, blur(22px)).
func set_look(fill: Color, highlight: Color, radius: float, backdrop_sigma: float) -> void:
	var material := _surface.material as ShaderMaterial
	material.set_shader_parameter("fill_color", fill)
	material.set_shader_parameter("highlight_color", highlight)
	material.set_shader_parameter("radius_px", radius)
	material.set_shader_parameter("sigma", backdrop_sigma)
	(_blur.material as ShaderMaterial).set_shader_parameter("sigma", backdrop_sigma)

## Lay the passes out on the card's box, its top-left at this node's position; the shadow reaches past it.
func set_box(box: Vector2) -> void:
	size = box
	_blur.position = Vector2.ZERO
	_blur.size = box
	(_blur.material as ShaderMaterial).set_shader_parameter("box_px", box)
	var pad := KERNEL_SIGMAS * _shadow_blur * SHADOW_SIGMA_SHARE + _shadow_offset.length()
	_surface.position = -Vector2.ONE * pad
	_surface.size = box + Vector2.ONE * 2.0 * pad
	var surface_material := _surface.material as ShaderMaterial
	surface_material.set_shader_parameter("box_px", box)
	surface_material.set_shader_parameter("pad_px", pad)

func _screen_copy() -> BackBufferCopy:
	var copy := BackBufferCopy.new()
	copy.copy_mode = BackBufferCopy.COPY_MODE_VIEWPORT
	return copy

func _shader_rect(node_name: String, shader: Shader) -> ColorRect:
	var rect := ColorRect.new()
	rect.name = node_name
	rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var material := ShaderMaterial.new()
	material.shader = shader
	material.set_shader_parameter("sigma", BACKDROP_SIGMA)
	if shader == SURFACE_SHADER:
		material.set_shader_parameter("radius_px", RADIUS)
		material.set_shader_parameter("border_px", BORDER_PX)
		material.set_shader_parameter("saturation", SATURATION)
		material.set_shader_parameter("fill_color", FILL)
		material.set_shader_parameter("border_color", BORDER)
		material.set_shader_parameter("highlight_color", HIGHLIGHT)
		material.set_shader_parameter("highlight_px", HIGHLIGHT_PX)
		material.set_shader_parameter("ring_color", RING)
		material.set_shader_parameter("ring_px", RING_PX)
		material.set_shader_parameter("shadow_color", SHADOW)
		material.set_shader_parameter("shadow_offset_px", SHADOW_OFFSET)
		material.set_shader_parameter("shadow_sigma", SHADOW_BLUR * SHADOW_SIGMA_SHARE)
	rect.material = material
	add_child(rect)
	return rect
