class_name Nameplate extends Sprite3D
## Billboard name plate over another player — port of web game/fx/nameplate.ts: a 256 x 64 texture drawn once (a
## rounded background in the team colour for 2v2 or a neutral grey for FFA at 85% opacity, the name in bold 34 px
## monospace, dark), shown 1.6 x 0.4 world units big 1.35 above the body; it never writes depth and dies with the body.

const PLATE_SIZE := Vector2i(256, 64)
const PLATE_RADIUS := 18
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

## The web canvas texture carries no colour space, so three.js reads its sRGB-authored values as linear light; the
## canvas here is authored in those displayed colours instead.
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
	var panel := Panel.new()
	var box := StyleBoxFlat.new()
	box.bg_color = web_canvas_color(Color(background, BACKGROUND_ALPHA))
	box.set_corner_radius_all(PLATE_RADIUS)
	panel.add_theme_stylebox_override("panel", box)
	panel.size = Vector2(PLATE_SIZE)
	_viewport.add_child(panel)
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
	texture = _viewport.get_texture()
	# A transparent viewport stores premultiplied colour: blend it as such, unlit, without writing depth.
	var material := StandardMaterial3D.new()
	material.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	material.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	material.blend_mode = BaseMaterial3D.BLEND_MODE_PREMULT_ALPHA
	material.cull_mode = BaseMaterial3D.CULL_DISABLED
	material.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED
	material.albedo_texture = texture
	material_override = material

func text() -> String:
	return (_viewport.get_node("Text") as Label).text
