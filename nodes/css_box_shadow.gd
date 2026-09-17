class_name CssBoxShadow
## An outer CSS `box-shadow` under a box, drawn by box_shadow.gdshader: a quad reaching three sigmas (plus the offset and a
## positive spread) past the box. Add the quad before the box it shadows and place() it whenever the box moves.

const SHADER := preload("res://assets/shaders/box_shadow.gdshader")
const REACH_SIGMAS := 3.0
const SIGMA_PER_BLUR := 0.5                     # a box-shadow blur radius is 2σ

## `blur`: the CSS blur radius; `radius`: the box's border-radius (a round dot: half its size).
static func make(color: Color, blur: float, offset := Vector2.ZERO, spread := 0.0, radius := 0.0) -> ColorRect:
	var rect := ColorRect.new()
	rect.name = "BoxShadow"
	rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var material := ShaderMaterial.new()
	material.shader = SHADER
	material.set_shader_parameter("shadow_color", color)
	material.set_shader_parameter("shadow_sigma", blur * SIGMA_PER_BLUR)
	material.set_shader_parameter("shadow_offset_px", offset)
	material.set_shader_parameter("shadow_spread_px", spread)
	material.set_shader_parameter("radius_px", radius)
	rect.material = material
	return rect

## Lay the quad around a box of `box` size at `origin`, both in the quad's parent coordinates.
static func place(rect: ColorRect, origin: Vector2, box: Vector2) -> void:
	var material := rect.material as ShaderMaterial
	var sigma: float = material.get_shader_parameter("shadow_sigma")
	var offset: Vector2 = material.get_shader_parameter("shadow_offset_px")
	var spread: float = material.get_shader_parameter("shadow_spread_px")
	var pad := REACH_SIGMAS * sigma + maxf(absf(offset.x), absf(offset.y)) + maxf(spread, 0.0)
	material.set_shader_parameter("box_px", box)
	material.set_shader_parameter("pad_px", pad)
	rect.position = origin - Vector2.ONE * pad
	rect.size = box + Vector2.ONE * 2.0 * pad
