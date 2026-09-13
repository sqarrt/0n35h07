class_name MapEdges extends Node3D
## Screen-space outline of visible block edges — port of web MapEdges (EdgeOutline.tsx), on while the profile's
## postProcessing is. The blocks of the raycast groups (web BLOCK_LAYER) get normal-pass copies on their own visual
## layer, rendered by a camera that follows the main one into a float SubViewport; a full-screen quad drawn after
## everything lightens the frame where that pass has a normal discontinuity on a visible block.

const GROUP := "map_edge_blocks"
const BLOCK_LAYER_BIT := 1 << 19                 # visual layer 20: the block normal copies
const NORMALS_SHADER := preload("res://assets/shaders/block_normals.gdshader")
const EDGES_SHADER := preload("res://assets/shaders/map_edges.gdshader")
const THICKNESS := 1.0                            # web EdgeOutline THICKNESS
const THRESHOLD := 0.1                            # web THRESH
const GAIN := 2.0                                 # web GAIN
const DEPTH_EPS := 0.15                           # web DEPTH_EPS
const QUAD_SIZE := Vector2(2.0, 2.0)              # clip space -1..1
const CULL_MARGIN := 16384.0                      # the quad covers the screen wherever its node is

var enabled := true: set = set_enabled

var _copies: Array[MeshInstance3D] = []
var _viewport: SubViewport
var _camera: Camera3D
var _quad: MeshInstance3D

## Put a block mesh into the outline pass (web layers.enable(BLOCK_LAYER) on the raycast groups).
static func mark_block(block: MeshInstance3D) -> void:
	block.add_to_group(GROUP)

func _ready() -> void:
	name = "MapEdges"
	var normals := ShaderMaterial.new()
	normals.shader = NORMALS_SHADER
	for node in get_tree().get_nodes_in_group(GROUP):
		var block := node as MeshInstance3D
		var copy := MeshInstance3D.new()
		copy.mesh = block.mesh
		copy.material_override = normals
		copy.layers = BLOCK_LAYER_BIT
		copy.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		copy.top_level = true
		add_child(copy)
		copy.global_transform = block.global_transform
		_copies.append(copy)
	_viewport = SubViewport.new()
	_viewport.name = "BlockNormals"
	_viewport.use_hdr_2d = true
	_viewport.transparent_bg = true
	_viewport.msaa_3d = Viewport.MSAA_DISABLED
	_viewport.screen_space_aa = Viewport.SCREEN_SPACE_AA_DISABLED
	_viewport.use_taa = false
	_viewport.use_debanding = false
	_viewport.size = get_viewport().size
	_camera = Camera3D.new()
	_camera.cull_mask = BLOCK_LAYER_BIT
	_camera.environment = _flat_environment()
	_viewport.add_child(_camera)
	add_child(_viewport)
	_quad = MeshInstance3D.new()
	_quad.name = "EdgeQuad"
	var quad_mesh := QuadMesh.new()
	quad_mesh.size = QUAD_SIZE
	_quad.mesh = quad_mesh
	_quad.extra_cull_margin = CULL_MARGIN
	_quad.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	var edges := ShaderMaterial.new()
	edges.shader = EDGES_SHADER
	edges.render_priority = Material.RENDER_PRIORITY_MAX
	edges.set_shader_parameter("block_normals", _viewport.get_texture())
	edges.set_shader_parameter("thickness", THICKNESS)
	edges.set_shader_parameter("threshold", THRESHOLD)
	edges.set_shader_parameter("gain", GAIN)
	edges.set_shader_parameter("depth_eps", DEPTH_EPS)
	_quad.material_override = edges
	add_child(_quad)
	RenderingServer.frame_pre_draw.connect(sync_camera)
	set_enabled(enabled)

func _exit_tree() -> void:
	if RenderingServer.frame_pre_draw.is_connected(sync_camera):
		RenderingServer.frame_pre_draw.disconnect(sync_camera)

func set_enabled(on: bool) -> void:
	enabled = on
	if _quad == null:
		return
	_quad.visible = on
	_viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS if on else SubViewport.UPDATE_DISABLED

func copies() -> Array[MeshInstance3D]:
	return _copies

func normals_viewport() -> SubViewport:
	return _viewport

func normals_camera() -> Camera3D:
	return _camera

func quad() -> MeshInstance3D:
	return _quad

## Right before drawing: follow the main camera exactly and keep the normal copies out of its view.
func sync_camera() -> void:
	var main := get_viewport().get_camera_3d()
	if main == null or main == _camera:
		return
	main.cull_mask &= ~BLOCK_LAYER_BIT
	_camera.global_transform = main.global_transform
	_camera.projection = main.projection
	_camera.fov = main.fov
	_camera.keep_aspect = main.keep_aspect
	_camera.near = main.near
	_camera.far = main.far
	_camera.h_offset = main.h_offset
	_camera.v_offset = main.v_offset
	if _viewport.size != get_viewport().size:
		_viewport.size = get_viewport().size

## Nothing but the unshaded pass output: no sky, ambient, glow or fog, and a linear tonemap.
func _flat_environment() -> Environment:
	var environment := Environment.new()
	environment.background_mode = Environment.BG_CLEAR_COLOR
	environment.ambient_light_source = Environment.AMBIENT_SOURCE_DISABLED
	environment.reflected_light_source = Environment.REFLECTION_SOURCE_DISABLED
	environment.tonemap_mode = Environment.TONE_MAPPER_LINEAR
	return environment
