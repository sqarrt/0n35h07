extends GutTest
## Appearance controls — web `.swatch` (32 px circle, 2 px #223 ring; selected 3 px text ring with a 10 px glow; dimmed
## 25%) and ui/BallPaintField (caption, 132 px canvas at 8.25 px cell steps clipped to a circle, CLEAR, 0.4rem gaps).

const EPS := 0.05
const COLOR_EPS := 0.02
const CENTRE_CELL := 8
const CELL_INSET := 2                       # a pixel well inside a cell

func test_swatch_rings_glow_and_dimming() -> void:
	var swatch := ColorSwatch.new(Color("#ffaa44"))
	add_child_autofree(swatch)
	assert_eq(swatch.get_combined_minimum_size(), Vector2(ColorSwatch.SIZE, ColorSwatch.SIZE))
	var material := (swatch.get_node("Paint") as ColorRect).material as ShaderMaterial
	assert_eq(material.get_shader_parameter("ring_px"), ColorSwatch.BORDER_PX)
	assert_eq(material.get_shader_parameter("sigma"), 0.0, "no glow until selected")
	swatch.set_selected(true)
	assert_eq(material.get_shader_parameter("ring_px"), ColorSwatch.SELECTED_BORDER_PX)
	assert_eq(material.get_shader_parameter("ring_color"), UiTokens.TEXT)
	assert_almost_eq(float(material.get_shader_parameter("sigma")), ColorSwatch.GLOW_BLUR * 0.5, EPS, "box-shadow σ = blur / 2")
	swatch.set_dimmed(true)
	assert_eq(swatch.modulate.a, ColorSwatch.DIMMED_OPACITY)

func test_paint_field_box() -> void:
	var paint := BallPaintField.new("FRONT", BallArt.empty()[BallArt.FRONT])
	add_child_autofree(paint)
	paint.size = paint.get_combined_minimum_size()
	assert_almost_eq(paint.get_combined_minimum_size().y, 179.8, EPS, "web column 179.78: 10 + 6.4 + 132 + 6.4 + 25")
	assert_almost_eq(paint.field().position.y, 16.4, EPS, "the canvas at 483.12 − 466.73")

func test_paint_field_cells_and_clip() -> void:
	var grid: PackedByteArray = BallArt.empty()[BallArt.FRONT]
	var paint := BallPaintField.new("FRONT", grid)
	add_child_autofree(paint)
	var inside := roundi(CENTRE_CELL * BallPaintField.CELL_PX) + CELL_INSET
	assert_true(paint.image().get_pixel(inside, inside).is_equal_approx(BallPaintField.PAPER), "an empty disc cell")
	assert_eq(paint.image().get_pixel(0, 0).a, 0.0, "the corner is clipped by border-radius 50%")
	grid[CENTRE_CELL * BallArt.SIZE + CENTRE_CELL] = 1
	paint.set_grid(grid)
	var ink := paint.image().get_pixel(inside, inside)
	assert_true(Vector3(ink.r, ink.g, ink.b).length() < COLOR_EPS, "a painted cell")

func test_pressing_paints_a_disc_cell() -> void:
	var paint := BallPaintField.new("FRONT", BallArt.empty()[BallArt.FRONT])
	add_child_autofree(paint)
	watch_signals(paint)
	var press := InputEventMouseButton.new()
	press.button_index = MOUSE_BUTTON_LEFT
	press.pressed = true
	press.position = Vector2.ONE * (CENTRE_CELL + 0.5) * BallPaintField.CELL_PX
	paint._on_field_input(press)
	assert_signal_emitted_with_parameters(paint, "painted", [CENTRE_CELL, CENTRE_CELL, 1])
	paint.erasing = true
	press.position = Vector2.ONE
	paint._on_field_input(press)
	assert_signal_emit_count(paint, "painted", 1, "a corner cell lies outside the disc")
