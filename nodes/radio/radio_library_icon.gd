class_name RadioLibraryIcon extends Control
## A Radio library icon — web RadioExplorer.css `.rexp-folder` / `.rexp-cass`, drawn by CSS there: border-box boxes whose
## children sit from the inside of the border. The folder (46×36): a 20×7 accent-fill tab (radius 2 / 4 on top) and a
## 46×31 body from y 5 in a #1c5e8f → #123c5b gradient with a 1 px accent-dim border, radius 3, a 10 px accent glow. The
## cassette (52×34): a #16486b → #0a1424 body with a 1 px accent border, radius 5, a 10 px accent glow; two 11 px reels
## (1.5 px accent-dim rings on #0a0c11) 7 px down, 10 px in from each side; a 10×3 accent-dim bar at 60% between them;
## a 6 px accent-16% strip 7 px in from the sides, 5 px from the bottom.

const BOX_SHADER := preload("res://assets/shaders/css_box.gdshader")
const FOLDER := "folder"
const TRACK := "track"
const FOLDER_SIZE := Vector2(46.0, 36.0)
const CASSETTE_SIZE := Vector2(52.0, 34.0)
const TAB := Rect2(2.0, 0.0, 20.0, 7.0)
const TAB_RADII := Vector4(2.0, 4.0, 0.0, 0.0)
const FOLDER_BODY := Rect2(0.0, 5.0, 46.0, 31.0)
const FOLDER_TOP := Color("#1c5e8f")
const FOLDER_BOTTOM := Color("#123c5b")
const FOLDER_RADIUS := 3.0
const FOLDER_GLOW_ALPHA := 0.18
const CASSETTE_TOP := Color("#16486b")
const CASSETTE_BOTTOM := Color("#0a1424")
const CASSETTE_RADIUS := 5.0
const CASSETTE_GLOW_ALPHA := 0.2
const GLOW_BLUR := 10.0
const BORDER_PX := 1.0
const REEL_PX := 11.0
const REEL_TOP := 7.0
const REEL_INSET := 10.0
const REEL_RING_PX := 1.5
const REEL_FILL := Color("#0a0c11")
const BAR := Rect2(21.0, 11.0, 10.0, 3.0)
const BAR_ALPHA := 0.6
const STRIP_INSET := 7.0
const STRIP_BOTTOM := 5.0
const STRIP_HEIGHT := 6.0
const STRIP_RADIUS := 2.0
const STRIP_ALPHA := 0.16
const HALF := 0.5

var kind := TRACK

func _init(icon_kind := TRACK) -> void:
	kind = icon_kind
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	custom_minimum_size = FOLDER_SIZE if kind == FOLDER else CASSETTE_SIZE
	size = custom_minimum_size
	if kind == FOLDER:
		_glow(FOLDER_BODY, FOLDER_RADIUS, FOLDER_GLOW_ALPHA)
		_box("Tab", TAB, TAB_RADII, UiTokens.ACCENT_FILL, UiTokens.ACCENT_FILL)
		_box("Body", FOLDER_BODY, Vector4.ONE * FOLDER_RADIUS, FOLDER_TOP, FOLDER_BOTTOM, UiTokens.ACCENT_DIM)
	else:
		var body := Rect2(Vector2.ZERO, CASSETTE_SIZE)
		_glow(body, CASSETTE_RADIUS, CASSETTE_GLOW_ALPHA)
		_box("Body", body, Vector4.ONE * CASSETTE_RADIUS, CASSETTE_TOP, CASSETTE_BOTTOM, UiTokens.ACCENT)
		var inner := Vector2.ONE * BORDER_PX                        # absolute children sit inside the border
		var inner_width := CASSETTE_SIZE.x - 2.0 * BORDER_PX
		var inner_height := CASSETTE_SIZE.y - 2.0 * BORDER_PX
		var strip := Rect2(inner + Vector2(STRIP_INSET, inner_height - STRIP_BOTTOM - STRIP_HEIGHT),
			Vector2(inner_width - 2.0 * STRIP_INSET, STRIP_HEIGHT))
		var strip_color := Color(UiTokens.ACCENT, STRIP_ALPHA)
		_box("Strip", strip, Vector4.ONE * STRIP_RADIUS, strip_color, strip_color)
		var bar_color := Color(UiTokens.ACCENT_DIM, BAR_ALPHA)
		_box("Bar", Rect2(inner + BAR.position, BAR.size), Vector4.ZERO, bar_color, bar_color)
		for x in [REEL_INSET, inner_width - REEL_INSET - REEL_PX]:
			_box("Reel", Rect2(inner + Vector2(x, REEL_TOP), Vector2.ONE * REEL_PX), Vector4.ONE * REEL_PX * HALF,
				REEL_FILL, REEL_FILL, UiTokens.ACCENT_DIM, REEL_RING_PX)

func _glow(box: Rect2, radius: float, alpha: float) -> void:
	var glow := CssBoxShadow.make(Color(UiTokens.ACCENT, alpha), GLOW_BLUR, Vector2.ZERO, 0.0, radius)
	add_child(glow)
	CssBoxShadow.place(glow, box.position, box.size)

func _box(node_name: String, box: Rect2, radii: Vector4, top: Color, bottom: Color, border := Color(0.0, 0.0, 0.0, 0.0),
		border_px := BORDER_PX) -> ColorRect:
	var rect := ColorRect.new()
	rect.name = node_name
	rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
	rect.position = box.position
	rect.size = box.size
	var material := ShaderMaterial.new()
	material.shader = BOX_SHADER
	material.set_shader_parameter("box_px", box.size)
	material.set_shader_parameter("radii", radii)
	material.set_shader_parameter("top_color", top)
	material.set_shader_parameter("bottom_color", bottom)
	material.set_shader_parameter("border_px", border_px if border.a > 0.0 else 0.0)
	material.set_shader_parameter("border_color", border)
	rect.material = material
	add_child(rect)
	return rect
