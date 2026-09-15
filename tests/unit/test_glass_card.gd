extends GutTest
## GlassCard — web components/glass.ts glassCard (the Radio player and the invite toast): the screen copied before each
## half of the 24 px backdrop blur, then the frosted surface with its hairline border, top highlight, outer ring and
## the 0 8px 40px shadow, all laid out on the card's own box.

const EPS := 0.01
const SCREEN := Vector2i(640, 360)
const BOX := Vector2(300.0, 120.0)

func _card() -> GlassCard:
	var viewport := SubViewport.new()
	viewport.size = SCREEN
	add_child_autofree(viewport)
	var card := GlassCard.new()
	viewport.add_child(card)
	card.set_box(BOX)
	return card

func test_the_screen_is_copied_before_each_blur_pass() -> void:
	var card := _card()
	var kinds := card.get_children().map(func(child: Node) -> String: return child.get_class())
	assert_eq(kinds, ["BackBufferCopy", "ColorRect", "BackBufferCopy", "ColorRect"], "copy, blur across, copy, blur down")
	assert_eq(card.blur().name, &"BackdropBlur")
	assert_eq(card.surface().name, &"Surface")

func test_the_passes_read_the_card_box() -> void:
	var card := _card()
	assert_eq(card.size, BOX)
	assert_eq(card.blur().size, BOX)
	assert_eq((card.blur().material as ShaderMaterial).get_shader_parameter("box_px"), BOX)
	var pad := GlassCard.KERNEL_SIGMAS * GlassCard.SHADOW_BLUR * GlassCard.SHADOW_SIGMA_SHARE + GlassCard.SHADOW_OFFSET.length()
	assert_eq(card.surface().position, -Vector2.ONE * pad, "the shadow reaches three sigmas past the box")
	assert_eq(card.surface().size, BOX + Vector2.ONE * 2.0 * pad)
	var surface := card.surface().material as ShaderMaterial
	assert_eq(surface.get_shader_parameter("box_px"), BOX)
	assert_almost_eq(float(surface.get_shader_parameter("pad_px")), pad, EPS)

func test_the_glass_ts_look() -> void:
	var surface := _card().surface().material as ShaderMaterial
	assert_almost_eq(float(surface.get_shader_parameter("sigma")), 24.0, EPS, "backdrop-filter blur(24px)")
	assert_almost_eq(float(surface.get_shader_parameter("saturation")), 1.6, EPS, "saturate(160%)")
	assert_almost_eq(float(surface.get_shader_parameter("radius_px")), 14.0, EPS)
	assert_almost_eq(float(surface.get_shader_parameter("shadow_sigma")), 20.0, EPS, "blur 40px = 2σ")
	assert_eq(surface.get_shader_parameter("fill_color"), Color(10.0 / 255.0, 15.0 / 255.0, 20.0 / 255.0, 0.55))

func test_a_window_takes_its_own_shadow_and_no_ring() -> void:
	var card := _card()
	card.set_shadow(Vector2(0.0, 18.0), 60.0, 0.0)
	var surface := card.surface().material as ShaderMaterial
	assert_almost_eq(float(surface.get_shader_parameter("shadow_sigma")), 30.0, EPS, "RadioExplorer.css 0 18px 60px")
	assert_eq(surface.get_shader_parameter("shadow_offset_px"), Vector2(0.0, 18.0))
	assert_almost_eq(float(surface.get_shader_parameter("ring_px")), 0.0, EPS)
	var pad := GlassCard.KERNEL_SIGMAS * 60.0 * GlassCard.SHADOW_SIGMA_SHARE + 18.0
	assert_almost_eq(float(surface.get_shader_parameter("pad_px")), pad, EPS, "the surface reaches the larger shadow")
	assert_eq(card.surface().size, BOX + Vector2.ONE * 2.0 * pad)
