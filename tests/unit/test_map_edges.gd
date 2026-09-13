extends GutTest
## Map edge outline parity with web MapEdges: only the raycast block groups enter the pass, their normal copies live on
## a layer the main camera never draws, the pass camera follows the main one, the web effect constants, and the profile
## switch.

const EPS := 0.001
const RAW := "res://maps/os_pillars.json"
const GEO := "res://maps/os_pillars_geo.json"

func _block() -> MeshInstance3D:
	var block := MeshInstance3D.new()
	block.mesh = BoxMesh.new()
	add_child_autofree(block)
	return block

func test_only_raycast_groups_are_marked() -> void:
	var map := GeoLoader.build(RAW, GEO)
	var blocks := map.get_children().filter(func(n: Node) -> bool: return n.is_in_group(MapBlocks.GROUP))
	var outlined := blocks.filter(func(n: Node) -> bool: return n.is_in_group(MapEdges.GROUP))
	assert_gt(outlined.size(), 0, "raycast groups are outlined")
	assert_lt(outlined.size(), blocks.size(), "no-raycast groups are not (web BLOCK_LAYER)")
	map.free()

func test_normal_copies_live_on_their_own_layer() -> void:
	var marked := _block()
	marked.position = Vector3(1.0, 2.0, 3.0)
	MapEdges.mark_block(marked)
	_block()
	var edges := MapEdges.new()
	add_child_autofree(edges)
	assert_eq(edges.copies().size(), 1, "one copy per marked block")
	var copy := edges.copies()[0]
	assert_eq(copy.layers, MapEdges.BLOCK_LAYER_BIT)
	assert_eq(copy.cast_shadow, GeometryInstance3D.SHADOW_CASTING_SETTING_OFF)
	assert_eq(copy.global_position, marked.position)
	assert_eq(edges.normals_camera().cull_mask, MapEdges.BLOCK_LAYER_BIT)
	assert_true(edges.normals_viewport().use_hdr_2d, "float: the view depth rides in the blue channel")
	var material := edges.quad().material_override as ShaderMaterial
	assert_almost_eq(material.get_shader_parameter("threshold"), MapEdges.THRESHOLD, EPS)
	assert_almost_eq(material.get_shader_parameter("depth_eps"), MapEdges.DEPTH_EPS, EPS)
	assert_eq(material.render_priority, Material.RENDER_PRIORITY_MAX, "drawn after everything")

func test_the_pass_camera_follows_the_main_camera() -> void:
	var main := Camera3D.new()
	add_child_autofree(main)
	main.current = true
	main.global_position = Vector3(4.0, 5.0, 6.0)
	main.fov = 95.0
	var edges := MapEdges.new()
	add_child_autofree(edges)
	edges.sync_camera()
	assert_eq(main.cull_mask & MapEdges.BLOCK_LAYER_BIT, 0, "the main view never draws the normal copies")
	assert_eq(edges.normals_camera().global_position, main.global_position)
	assert_almost_eq(edges.normals_camera().fov, 95.0, EPS)

func test_the_profile_switch_turns_the_outline_off() -> void:
	var edges := MapEdges.new()
	edges.enabled = false
	add_child_autofree(edges)
	assert_false(edges.quad().visible)
	assert_eq(edges.normals_viewport().render_target_update_mode, SubViewport.UPDATE_DISABLED)
	edges.enabled = true
	assert_true(edges.quad().visible)
