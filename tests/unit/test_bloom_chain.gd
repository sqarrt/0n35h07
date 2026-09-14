extends GutTest
## BloomChain (postprocessing BloomEffect, mipmap blur): mips halving like postprocessing, every stage nested inside its
## reader with the source innermost, the pass parameters, and the stages resting until active.

const SCREEN := Vector2i(1280, 720)
const MIPS := [Vector2i(640, 360), Vector2i(320, 180), Vector2i(160, 90), Vector2i(80, 45), Vector2i(40, 23),
	Vector2i(20, 12), Vector2i(10, 6), Vector2i(5, 3)]
const THRESHOLD := 0.2
const SMOOTHING := 0.6
const RADIUS := 0.7
const EPS := 0.0001

func _chain() -> BloomChain:
	var chain := BloomChain.new(THRESHOLD, SMOOTHING, RADIUS)
	add_child_autofree(chain)
	chain.set_size(SCREEN)
	return chain

func test_mips_halve_and_nest_inside_their_readers() -> void:
	var chain := _chain()
	var last := BloomChain.LEVELS - 1
	assert_eq(chain.luminance_viewport().size, SCREEN, "LuminancePass at full size")
	for i in MIPS.size():
		assert_eq(chain.down(i).size, MIPS[i], "Downsampling.Mipmap%d" % i)
		if i < last:
			assert_eq(chain.up(i).size, MIPS[i], "Upsampling.Mipmap%d" % i)
	assert_eq(chain.up(0).get_parent(), chain)
	for i in range(1, last):
		assert_eq(chain.up(i).get_parent(), chain.up(i - 1))
	assert_eq(chain.down(last).get_parent(), chain.up(last - 1))
	for i in last:
		assert_eq(chain.down(i).get_parent(), chain.down(i + 1))
	assert_eq(chain.luminance_viewport().get_parent(), chain.down(0))
	assert_eq(chain.stages().size(), BloomChain.LEVELS * 2, "7 up, 8 down, luminance")
	assert_eq(chain.texture(), chain.up(0).get_texture())

func test_the_source_renders_first_into_the_bright_pass() -> void:
	var chain := _chain()
	var source := SubViewport.new()
	chain.adopt(source)
	chain.set_source(source.get_texture())
	assert_eq(source.get_parent(), chain.luminance_viewport())
	var luminance := BloomChain.pass_material(chain.luminance_viewport())
	assert_eq(luminance.get_shader_parameter("source"), source.get_texture())
	assert_almost_eq(float(luminance.get_shader_parameter("threshold")), THRESHOLD, EPS)
	assert_almost_eq(float(luminance.get_shader_parameter("smoothing")), SMOOTHING, EPS)
	assert_almost_eq(float(BloomChain.pass_material(chain.up(0)).get_shader_parameter("radius")), RADIUS, EPS)

func test_it_rests_until_active() -> void:
	var chain := _chain()
	for stage in chain.stages():
		assert_eq(stage.render_target_update_mode, SubViewport.UPDATE_DISABLED)
	chain.set_active(true)
	for stage in chain.stages():
		assert_eq(stage.render_target_update_mode, SubViewport.UPDATE_ALWAYS)
