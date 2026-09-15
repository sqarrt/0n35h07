class_name RadioMarquee extends Control
## The Radio library's rubber band — web RadioExplorer.css `.rexp-marquee`: a fixed box from the press to the pointer,
## a 1 px accent border on accent 14% with 2 px corners and a 12 px accent-20% glow, above everything and letting the
## mouse through.

const BORDER_PX := 1.0
const FILL_ALPHA := 0.14
const RADIUS := 2.0
const GLOW_BLUR := 12.0
const GLOW_ALPHA := 0.2

var _glow: ColorRect
var _box: ColorRect

func _init() -> void:
	name = "RadioMarquee"
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	_glow = CssBoxShadow.make(Color(UiTokens.ACCENT, GLOW_ALPHA), GLOW_BLUR, Vector2.ZERO, 0.0, RADIUS)
	add_child(_glow)
	_box = ColorRect.new()
	_box.name = "Box"
	_box.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var look := ShaderMaterial.new()
	look.shader = RadioLibraryIcon.BOX_SHADER
	look.set_shader_parameter("radii", Vector4.ONE * RADIUS)
	look.set_shader_parameter("top_color", Color(UiTokens.ACCENT, FILL_ALPHA))
	look.set_shader_parameter("bottom_color", Color(UiTokens.ACCENT, FILL_ALPHA))
	look.set_shader_parameter("border_px", BORDER_PX)
	look.set_shader_parameter("border_color", UiTokens.ACCENT)
	_box.material = look
	add_child(_box)

## The band's border box in the parent's coordinates.
func place(rect: Rect2) -> void:
	position = rect.position
	size = rect.size
	_box.size = rect.size
	(_box.material as ShaderMaterial).set_shader_parameter("box_px", rect.size)
	CssBoxShadow.place(_glow, Vector2.ZERO, rect.size)
