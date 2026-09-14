class_name Nameplate extends Sprite3D
## Billboard name plate over another player — port of web game/fx/nameplate.ts: a 256 x 64 plate (a rounded background
## in the team colour for 2v2 or a neutral grey for FFA at 85% opacity, the name in bold 34 px monospace, dark), shown
## 1.6 x 0.4 world units big 1.35 above the body; it never writes depth and dies with the body. The web canvas has no
## colour space, so three.js shows its colours as linear light: the plate shader composites them that way.

const SHADER := preload("res://assets/shaders/nameplate.gdshader")
const PLATE_SIZE := Vector2i(256, 64)
const PLATE_RADIUS := 18.0
const FONT_SIZE := 34
const FONT_NAMES := ["Consolas", "DejaVu Sans Mono", "monospace"]   # Chrome's `monospace` on Windows is Consolas
const FONT_WEIGHT_BOLD := 700
const TEXT_COLOR := Color("#0a0d14")
const BACKGROUND_ALPHA := 0.85
const MAX_NAME_CHARS := 12
const ELLIPSIS := "…"
const HEIGHT := 1.35                      # web NAMEPLATE_HEIGHT, above the body origin
const WORLD_SIZE := Vector2(1.6, 0.4)     # web NAMEPLATE_SCALE
const NEUTRAL_COLOR := Color("#cccccc")   # web NAMEPLATE_NEUTRAL_COLOR: FFA, where the colour would code nothing

var _viewport: SubViewport

## The plate for `player_name` over `background` (GameModes.TEAM_COLORS in 2v2, NEUTRAL_COLOR in FFA).
static func create(player_name: String, background: Color) -> Nameplate:
	var plate := Nameplate.new()
	plate.name = "Nameplate"
	plate.build(player_name, background)
	return plate

## The name as drawn: longer names keep MAX_NAME_CHARS - 1 characters and an ellipsis.
static func label_text(player_name: String) -> String:
	if player_name.length() <= MAX_NAME_CHARS:
		return player_name
	return player_name.substr(0, MAX_NAME_CHARS - 1) + ELLIPSIS

## A canvas colour as three.js shows it (the canvas numbers read as linear light), for 2D drawing in sRGB.
static func web_canvas_color(color: Color) -> Color:
	return Color(color.linear_to_srgb(), color.a)

func build(player_name: String, background: Color) -> void:
	billboard = BaseMaterial3D.BILLBOARD_ENABLED
	pixel_size = WORLD_SIZE.x / PLATE_SIZE.x
	position.y = HEIGHT
	_viewport = SubViewport.new()
	_viewport.name = "Canvas"
	_viewport.size = PLATE_SIZE
	_viewport.transparent_bg = true
	_viewport.render_target_update_mode = SubViewport.UPDATE_ONCE   # the plate is static
	add_child(_viewport)
	var label := Label.new()
	label.name = "Text"
	label.text = label_text(player_name)
	label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	label.size = Vector2(PLATE_SIZE)
	var font := SystemFont.new()
	font.font_names = PackedStringArray(FONT_NAMES)
	font.font_weight = FONT_WEIGHT_BOLD
	label.add_theme_font_override("font", font)
	label.add_theme_font_size_override("font_size", FONT_SIZE)
	label.add_theme_color_override("font_color", web_canvas_color(TEXT_COLOR))
	_viewport.add_child(label)
	texture = _viewport.get_texture()             # also sizes the quad (pixel_size x the plate)
	var material := ShaderMaterial.new()
	material.shader = SHADER
	material.set_shader_parameter("text_texture", texture)
	material.set_shader_parameter("background_linear", Vector3(background.r, background.g, background.b))
	material.set_shader_parameter("background_alpha", BACKGROUND_ALPHA)
	material.set_shader_parameter("plate_px", Vector2(PLATE_SIZE))
	material.set_shader_parameter("radius_px", PLATE_RADIUS)
	material_override = material

func text() -> String:
	return (_viewport.get_node("Text") as Label).text
