extends GutTest
## Menu edge glow wiring — web MenuEdgeGlow + postprocessing BloomEffect: the mip sizes of the mipmap blur, every stage
## nested inside its reader (so it renders first), the chain resting while dark and rendering once lit, the model passes
## following the backdrop camera on layers that camera never draws, and the models' stand-ins copying them.

const SCREEN := Vector2i(1280, 720)
const DT := 1.0 / 60.0
const EPS := 0.0001
const LIGHT_FRAMES := 60
const PINNED_TIME := 1.0
const MIPS := [Vector2i(640, 360), Vector2i(320, 180), Vector2i(160, 90), Vector2i(80, 45), Vector2i(40, 23),
	Vector2i(20, 12), Vector2i(10, 6), Vector2i(5, 3)]
const PLANET := {"color": "#ffdd44", "model": "planet", "ring": "#dd4444", "art": ""}
const WAVES := {"color": "#aa44ff", "model": "waves", "ring": "#44aaff", "art": ""}

func _backdrop() -> MenuBackdrop:
	var viewport := SubViewport.new()
	viewport.size = SCREEN
	add_child_autofree(viewport)
	var backdrop := MenuBackdrop.new()
	viewport.add_child(backdrop)
	backdrop.size = Vector2(SCREEN)
	return backdrop

func test_mips_halve_like_postprocessing() -> void:
	var glow := _backdrop().glow()
	assert_eq(glow.edge_viewport().size, SCREEN)
	assert_eq(glow.luminance_viewport().size, SCREEN, "LuminancePass at full size")
	for i in MIPS.size():
		assert_eq(glow.down(i).size, MIPS[i], "Downsampling.Mipmap%d" % i)
		if i < MenuEdgeGlow.BLOOM_LEVELS - 1:
			assert_eq(glow.up(i).size, MIPS[i], "Upsampling.Mipmap%d" % i)

func test_every_stage_renders_before_its_reader() -> void:
	var backdrop := _backdrop()
	var glow := backdrop.glow()
	var last := MenuEdgeGlow.BLOOM_LEVELS - 1
	assert_eq(glow.up(0).get_parent(), glow)
	for i in range(1, last):
		assert_eq(glow.up(i).get_parent(), glow.up(i - 1))
	assert_eq(glow.down(last).get_parent(), glow.up(last - 1))
	for i in last:
		assert_eq(glow.down(i).get_parent(), glow.down(i + 1))
	assert_eq(glow.luminance_viewport().get_parent(), glow.down(0))
	assert_eq(glow.edge_viewport().get_parent(), glow.luminance_viewport())
	assert_eq(glow.depth_viewport().get_parent(), glow.edge_viewport())
	assert_eq(glow.color_viewport().get_parent(), glow.edge_viewport())
	assert_eq(backdrop.world().get_parent(), glow.depth_viewport(), "the scene renders before its glow")
	for stage in [glow.depth_viewport(), glow.color_viewport()]:
		assert_eq(stage.world_3d, backdrop.world().find_world_3d(), "one world, three cameras")
	assert_eq(glow.viewports().size(), MenuEdgeGlow.BLOOM_LEVELS * 2 + 3, "7 up, 8 down, luminance, edge, 2 model passes")
	assert_true(backdrop.world().use_hdr_2d, "linear float like the web HalfFloat target: light above 1 blooms")

func test_dark_rests_and_lit_renders() -> void:
	var backdrop := _backdrop()
	backdrop._process(DT)
	for stage in backdrop.glow().viewports():
		assert_eq(stage.render_target_update_mode, SubViewport.UPDATE_DISABLED, "silence: %s rests" % stage.name)
	backdrop.pin_glow_level(1.0)
	for i in LIGHT_FRAMES:
		backdrop._process(DT)
	assert_true(backdrop.glow().is_lit())
	for stage in backdrop.glow().viewports():
		assert_eq(stage.render_target_update_mode, SubViewport.UPDATE_ALWAYS)
	var composite := backdrop.view().material as ShaderMaterial
	assert_true(composite.get_shader_parameter("lit"))
	assert_gt(float(backdrop.glow().edge_material().get_shader_parameter("intensity")), 0.0)

func test_the_model_passes_follow_the_camera_unseen() -> void:
	var backdrop := _backdrop()
	backdrop._process(DT)
	var glow := backdrop.glow()
	for camera in [glow.depth_camera(), glow.color_camera()]:
		assert_true(camera.global_transform.is_equal_approx(backdrop.camera().global_transform))
	assert_eq(backdrop.camera().cull_mask & MenuEdgeGlow.GLOW_LAYERS, 0, "the backdrop never draws the stand-ins")
	assert_eq(glow.depth_camera().cull_mask, MenuEdgeGlow.DEPTH_LAYER_BIT)
	assert_eq(glow.color_camera().cull_mask, MenuEdgeGlow.COLOR_LAYER_BIT)

func test_stand_ins_copy_the_models() -> void:
	var backdrop := _backdrop()
	backdrop.pin_ball_time(PINNED_TIME)
	backdrop.set_balls([{"key": "slot-1", "spec": PLANET, "spot": MenuStage.STAGE_SPOTS[1]},
		{"key": "slot-2", "spec": WAVES, "spot": MenuStage.STAGE_SPOTS[2]}])
	backdrop._process(DT)
	backdrop.glow().sync_models()
	var planet := backdrop.ball_for("slot-1")
	var ball_proxy := planet.ball().get_node(MenuEdgeGlow.BALL_PROXY) as MeshInstance3D
	assert_eq(ball_proxy.layers, MenuEdgeGlow.GLOW_LAYERS, "a black ball in both model passes")
	assert_eq(ball_proxy.mesh, planet.ball().mesh)
	var ring := planet.ring()
	assert_eq((ring.get_node(MenuEdgeGlow.RING_DEPTH_PROXY) as MeshInstance3D).layers, MenuEdgeGlow.DEPTH_LAYER_BIT)
	var ring_color := ring.get_node(MenuEdgeGlow.RING_COLOR_PROXY) as MeshInstance3D
	assert_eq(ring_color.layers, MenuEdgeGlow.COLOR_LAYER_BIT)
	var ring_material := ring_color.material_override as ShaderMaterial
	assert_eq(ring_material.shader, BallVisual.RING_SHADER, "the ring keeps its colour")
	assert_eq(ring_material.get_shader_parameter("ring_color"), Color(PLANET["ring"]))
	assert_almost_eq(float(ring_material.get_shader_parameter("time")), PINNED_TIME, EPS)
	var wavy := backdrop.ball_for("slot-2").ball().get_node(MenuEdgeGlow.BALL_PROXY) as MeshInstance3D
	var wavy_material := wavy.material_override as ShaderMaterial
	assert_true(wavy_material.get_shader_parameter("waves"), "the stand-in keeps the wave silhouette")
	assert_almost_eq(float(wavy_material.get_shader_parameter("time")), PINNED_TIME, EPS)
