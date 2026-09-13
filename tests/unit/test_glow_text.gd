extends GutTest
## GlowText: text with real blurred CSS text-shadows — a glyph mask viewport, one horizontal-blur viewport per shadow
## and a vertical-blur + tint layer on screen, first shadow on top, the sharp text above every glow.

const SCREEN := Vector2i(1280, 720)
const EPS := 0.001
const FONT_SIZE := 24

func _glow() -> GlowText:
	var screen := SubViewport.new()
	screen.size = SCREEN
	add_child_autofree(screen)
	var glow := GlowText.new()
	screen.add_child(glow)
	glow.configure(UiFont.base(), FONT_SIZE, Color.WHITE)
	glow.set_text("YOU: CATALYST")
	return glow

func test_without_shadows_it_is_just_the_text() -> void:
	var glow := _glow()
	assert_eq(glow.layer_count(), 0)
	assert_eq(glow.find_children("*", "SubViewport", true, false).size(), 0, "no viewports without shadows")
	assert_eq(glow.label().text, "YOU: CATALYST")
	assert_eq(glow.get_combined_minimum_size(), glow.label().get_minimum_size(), "lays out like the text")

func test_size_follows_the_font_once_the_theme_settles() -> void:
	var glow := _glow()
	await get_tree().process_frame
	assert_eq(glow.get_combined_minimum_size(), glow.label().get_minimum_size())
	assert_eq(glow.label().size, glow.label().get_minimum_size())

func test_each_shadow_is_a_two_pass_blur_under_the_text() -> void:
	var glow := _glow()
	var pc := Color("#3377ff")
	glow.set_shadows([CssShadow.make(6.0, Color.WHITE), CssShadow.make(32.0, pc)])
	assert_eq(glow.layer_count(), 2)
	assert_eq(glow.find_children("*", "SubViewport", true, false).size(), 3, "mask + one horizontal pass per shadow")
	assert_eq(glow.padding(), 48, "3 sigma of the widest (32 px) blur")
	var layers := glow.layers()
	assert_eq(layers[0].get_index() > layers[1].get_index(), true, "the first CSS shadow paints on top")
	assert_eq(glow.label().get_index(), glow.get_child_count() - 1, "sharp text above every glow")
	var top := layers[0].material as ShaderMaterial
	assert_almost_eq(top.get_shader_parameter("sigma"), 3.0, EPS)
	assert_eq(top.get_shader_parameter("direction"), GlowText.VERTICAL)
	assert_eq(top.get_shader_parameter("tint"), Color.WHITE)
	assert_eq((layers[1].material as ShaderMaterial).get_shader_parameter("tint"), pc)
	assert_eq(layers[1].position, -Vector2.ONE * glow.padding())
	assert_eq(glow.mask_label().text, glow.label().text, "the mask mirrors the text")

func test_offset_shadows_shift_their_layer() -> void:
	var glow := _glow()
	glow.set_shadows([CssShadow.make(0.0, Color.WHITE, Vector2(-1.0, 0.0))])
	assert_eq(glow.layers()[0].position, Vector2(-glow.padding() - 1.0, -glow.padding()))

func test_updating_shadows_keeps_the_nodes_and_never_shrinks_the_padding() -> void:
	var glow := _glow()
	glow.set_shadows([CssShadow.make(18.0, Color.WHITE)])
	var layer := glow.layers()[0]
	var padding := glow.padding()
	glow.set_shadows([CssShadow.make(8.0, Color.WHITE)])
	assert_same(glow.layers()[0], layer, "same count -> same nodes (animated glows don't rebuild)")
	assert_almost_eq((layer.material as ShaderMaterial).get_shader_parameter("sigma"), 4.0, EPS)
	assert_eq(glow.padding(), padding, "viewports keep their size while a glow throbs")

func test_text_changes_reach_the_mask_and_the_size() -> void:
	var glow := _glow()
	glow.set_shadows([CssShadow.make(12.0, Color.WHITE)])
	var before := glow.get_combined_minimum_size()
	glow.set_text("YOU: SINGULARITY")
	assert_eq(glow.mask_label().text, "YOU: SINGULARITY")
	assert_gt(glow.get_combined_minimum_size().x, before.x)
