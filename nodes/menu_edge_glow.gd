class_name MenuEdgeGlow extends Node
## Glow on the visible edges of the menu models — port of web MenuEdgeGlow with its postprocessing BloomEffect
## (mipmap blur). A chain of float viewports, each nested inside the one that reads it so it renders first in a frame:
##   Up0 ⊃ Up1 ⊃ … ⊃ Up6 ⊃ Down7 ⊃ … ⊃ Down0 ⊃ Luminance ⊃ Edge ⊃ {Depth ⊃ the backdrop's world viewport, ModelColor}
## The model passes see only stand-ins of the menu models on their own layers (web renders the models on a layer the
## lights are not on: balls come out black, rings keep their colour; ring depth is written): Depth stores their linear
## depth through a full-screen quad, ModelColor their colour. Edge adds the depth-jump outline to the decoded scene in
## linear light; Luminance keeps what is brighter than the bloom threshold; the Down / Up mips blur it
## (MipmapBlurPass). The backdrop composite screen-blends Edge with Up0. The chain only renders while lit.

const DEPTH_LAYER_BIT := 1 << 18                     # visual layer 19: the depth quad, ball and ring-depth stand-ins
const COLOR_LAYER_BIT := 1 << 17                     # visual layer 18: ball stand-ins and ring colour copies
const GLOW_LAYERS := DEPTH_LAYER_BIT | COLOR_LAYER_BIT
const DEPTH_SHADER := preload("res://assets/shaders/menu_glow_depth.gdshader")
const PROXY_SHADER := preload("res://assets/shaders/menu_glow_proxy.gdshader")
const EDGE_SHADER := preload("res://assets/shaders/menu_edge_glow.gdshader")
const LUMINANCE_SHADER := preload("res://assets/shaders/bloom_luminance.gdshader")
const DOWNSAMPLE_SHADER := preload("res://assets/shaders/bloom_downsample.gdshader")
const UPSAMPLE_SHADER := preload("res://assets/shaders/bloom_upsample.gdshader")
const BLOOM_LEVELS := 8                              # postprocessing MipmapBlurPass levels (BloomEffect default)
const BLOOM_THRESHOLD := 1.1                         # web BLOOM_THRESHOLD
const BLOOM_SMOOTHING := 0.3                         # web BLOOM_SMOOTHING
const BLOOM_RADIUS := 0.55                           # web BLOOM_RADIUS
const BLOOM_INTENSITY := 1.5                         # web BLOOM_INTENSITY
const BLUR_PX := 4.0                                 # web BLUR_PX
const GRAD_PX := 1.5                                 # web GRAD_PX
const DEPTH_THRESH := 0.05                           # web DEPTH_THRESH
const EDGE_GAIN := 4.0                               # web EDGE_GAIN
const EDGE_WHITE := 0.15                             # web EDGE_WHITE
const BALL_PROXY := "GlowBall"
const RING_DEPTH_PROXY := "GlowRingDepth"
const RING_COLOR_PROXY := "GlowRingColor"
const BALL_PARAMS := ["waves", "time"]
const RING_PARAMS := ["ring_color", "time", "opacity"]
const QUAD_SIZE := Vector2(2.0, 2.0)                 # clip space -1..1
const CULL_MARGIN := 16384.0                         # the quad covers the screen wherever its node is
const HALF := 0.5

var _depth: SubViewport
var _depth_camera: Camera3D
var _color: SubViewport
var _color_camera: Camera3D
var _edge: SubViewport
var _luminance: SubViewport
var _down: Array[SubViewport] = []
var _up: Array[SubViewport] = []
var _chain: Array[SubViewport] = []                  # outer → inner
var _models: Array[Dictionary] = []                  # [{visual, ball: ShaderMaterial, ring: ShaderMaterial | null}]
var _lit := false

func _ready() -> void:
	name = "Glow"
	var outer: Node = self
	for i in BLOOM_LEVELS - 1:
		outer = _add_stage(outer, "Up%d" % i, UPSAMPLE_SHADER)
		_up.append(outer)
	_down.resize(BLOOM_LEVELS)
	for i in range(BLOOM_LEVELS - 1, -1, -1):
		outer = _add_stage(outer, "Down%d" % i, DOWNSAMPLE_SHADER)
		_down[i] = outer
	_luminance = _add_stage(outer, "Luminance", LUMINANCE_SHADER)
	_edge = _add_stage(_luminance, "Edge", EDGE_SHADER)
	_depth = _model_stage("Depth", DEPTH_LAYER_BIT)
	_depth_camera = _depth.get_node("Camera")
	_depth.add_child(_depth_quad())
	_color = _model_stage("ModelColor", COLOR_LAYER_BIT)
	_color_camera = _color.get_node("Camera")
	_wire()

## Take the backdrop's world viewport in: it renders inside Depth (so before the whole chain); the model passes share
## its world.
func adopt_world(world: SubViewport) -> void:
	_depth.add_child(world)
	_depth.world_3d = world.find_world_3d()
	_color.world_3d = world.find_world_3d()
	_pass_material(_edge).set_shader_parameter("scene", world.get_texture())

## Every stage at the screen size, the mips halved like postprocessing (Math.round of half), texel sizes to match.
func set_size(size: Vector2i) -> void:
	var screen := Vector2i(maxi(size.x, 1), maxi(size.y, 1))
	for stage in [_depth, _color, _edge, _luminance]:
		_resize(stage, screen)
	var mip := screen
	for i in BLOOM_LEVELS:
		mip = Vector2i(maxi(floori(mip.x * HALF + HALF), 1), maxi(floori(mip.y * HALF + HALF), 1))
		_resize(_down[i], mip)
		if i < _up.size():
			_resize(_up[i], mip)
	_pass_material(_edge).set_shader_parameter("texel", Vector2.ONE / Vector2(screen))
	for i in BLOOM_LEVELS:
		_pass_material(_down[i]).set_shader_parameter("texel", Vector2.ONE / Vector2(_down_source(i).size))
	for i in _up.size():
		_pass_material(_up[i]).set_shader_parameter("texel", Vector2.ONE / Vector2(_up_source(i).size))

## Follow the backdrop camera exactly, right before this frame draws.
func sync_camera(main: Camera3D) -> void:
	for camera in [_depth_camera, _color_camera]:
		camera.global_transform = main.global_transform
		camera.projection = main.projection
		camera.fov = main.fov
		camera.keep_aspect = main.keep_aspect
		camera.near = main.near
		camera.far = main.far

func set_lit(on: bool) -> void:
	_lit = on
	var mode := SubViewport.UPDATE_ALWAYS if on else SubViewport.UPDATE_DISABLED
	for stage in _chain:
		stage.render_target_update_mode = mode

func is_lit() -> bool:
	return _lit

## web uIntensity: the edge brightness this frame (MenuGlowLevel.intensity).
func set_intensity(value: float) -> void:
	_pass_material(_edge).set_shader_parameter("intensity", value)

## Give a menu model its stand-ins (again after a model change: missing ones are added).
func add_model(visual: BallVisual) -> void:
	var entry := _model_entry(visual)
	if entry.is_empty():
		entry = {"visual": visual, "ball": null, "ring": null}
		_models.append(entry)
	var ball := visual.ball()
	if not ball.has_node(BALL_PROXY):
		entry["ball"] = _add_proxy(ball, BALL_PROXY, PROXY_SHADER, GLOW_LAYERS)
	var ring := visual.ring()
	if ring != null and not ring.has_node(RING_DEPTH_PROXY):
		_add_proxy(ring, RING_DEPTH_PROXY, PROXY_SHADER, DEPTH_LAYER_BIT)
		entry["ring"] = _add_proxy(ring, RING_COLOR_PROXY, BallVisual.RING_SHADER, COLOR_LAYER_BIT)
	sync_models()

## The stand-ins take this frame's wave shape, ring colour, band drift and fade from their models.
func sync_models() -> void:
	_models.assign(_models.filter(func(e: Dictionary) -> bool: return is_instance_valid(e["visual"])))
	for entry in _models:
		var visual: BallVisual = entry["visual"]
		_copy_params(visual.material(), entry["ball"], BALL_PARAMS)
		if entry["ring"] != null:
			_copy_params(visual.ring().material_override as ShaderMaterial, entry["ring"], RING_PARAMS)

func edge_texture() -> Texture2D:
	return _edge.get_texture()

func bloom_texture() -> Texture2D:
	return _up[0].get_texture()

func viewports() -> Array[SubViewport]:
	return _chain

func down(level: int) -> SubViewport:
	return _down[level]

func up(level: int) -> SubViewport:
	return _up[level]

func luminance_viewport() -> SubViewport:
	return _luminance

func edge_viewport() -> SubViewport:
	return _edge

func depth_viewport() -> SubViewport:
	return _depth

func color_viewport() -> SubViewport:
	return _color

func depth_camera() -> Camera3D:
	return _depth_camera

func color_camera() -> Camera3D:
	return _color_camera

func edge_material() -> ShaderMaterial:
	return _pass_material(_edge)

## Sources between the stages: Edge → Luminance → Down0 … Down7 → Up6 … Up0, each Up over its same-size Down.
func _wire() -> void:
	var edge := _pass_material(_edge)
	edge.set_shader_parameter("model_depth", _depth.get_texture())
	edge.set_shader_parameter("model_color", _color.get_texture())
	edge.set_shader_parameter("blur_px", BLUR_PX)
	edge.set_shader_parameter("grad_px", GRAD_PX)
	edge.set_shader_parameter("thresh", DEPTH_THRESH)
	edge.set_shader_parameter("gain", EDGE_GAIN)
	edge.set_shader_parameter("white", EDGE_WHITE)
	var luminance := _pass_material(_luminance)
	luminance.set_shader_parameter("source", _edge.get_texture())
	luminance.set_shader_parameter("threshold", BLOOM_THRESHOLD)
	luminance.set_shader_parameter("smoothing", BLOOM_SMOOTHING)
	for i in BLOOM_LEVELS:
		_pass_material(_down[i]).set_shader_parameter("source", _down_source(i).get_texture())
	for i in _up.size():
		var material := _pass_material(_up[i])
		material.set_shader_parameter("source", _up_source(i).get_texture())
		material.set_shader_parameter("support", _down[i].get_texture())
		material.set_shader_parameter("radius", BLOOM_RADIUS)

func _down_source(level: int) -> SubViewport:
	return _luminance if level == 0 else _down[level - 1]

func _up_source(level: int) -> SubViewport:
	return _down[BLOOM_LEVELS - 1] if level == _up.size() - 1 else _up[level + 1]

## A float 2D stage: one full-size rect running `shader`, nested in `outer`.
func _add_stage(outer: Node, stage_name: String, shader: Shader) -> SubViewport:
	var stage := SubViewport.new()
	stage.name = stage_name
	stage.use_hdr_2d = true
	stage.transparent_bg = true
	stage.disable_3d = true
	stage.render_target_update_mode = SubViewport.UPDATE_DISABLED
	var rect := ColorRect.new()
	rect.name = "Pass"
	var material := ShaderMaterial.new()
	material.shader = shader
	rect.material = material
	stage.add_child(rect)
	outer.add_child(stage)
	_chain.append(stage)
	return stage

## A model pass inside Edge: the shared world through a following camera that sees only `layer`, no MSAA, float.
func _model_stage(stage_name: String, layer: int) -> SubViewport:
	var stage := SubViewport.new()
	stage.name = stage_name
	stage.use_hdr_2d = true
	stage.transparent_bg = true
	stage.msaa_3d = Viewport.MSAA_DISABLED
	stage.screen_space_aa = Viewport.SCREEN_SPACE_AA_DISABLED
	stage.use_taa = false
	stage.use_debanding = false
	stage.render_target_update_mode = SubViewport.UPDATE_DISABLED
	var camera := Camera3D.new()
	camera.name = "Camera"
	camera.cull_mask = layer
	camera.environment = _flat_environment()
	stage.add_child(camera)
	_edge.add_child(stage)
	_chain.append(stage)
	return stage

## The quad drawn last in Depth: the depth buffer as linear depth and an on-model flag.
func _depth_quad() -> MeshInstance3D:
	var quad := MeshInstance3D.new()
	quad.name = "DepthQuad"
	var quad_mesh := QuadMesh.new()
	quad_mesh.size = QUAD_SIZE
	quad.mesh = quad_mesh
	quad.layers = DEPTH_LAYER_BIT
	quad.extra_cull_margin = CULL_MARGIN
	quad.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	var material := ShaderMaterial.new()
	material.shader = DEPTH_SHADER
	material.render_priority = Material.RENDER_PRIORITY_MAX
	quad.material_override = material
	return quad

func _add_proxy(model: MeshInstance3D, proxy_name: String, shader: Shader, layers: int) -> ShaderMaterial:
	var proxy := MeshInstance3D.new()
	proxy.name = proxy_name
	proxy.mesh = model.mesh
	var material := ShaderMaterial.new()
	material.shader = shader
	proxy.material_override = material
	proxy.layers = layers
	proxy.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	model.add_child(proxy)
	return material

func _model_entry(visual: BallVisual) -> Dictionary:
	for entry in _models:
		if is_instance_valid(entry["visual"]) and entry["visual"] == visual:
			return entry
	return {}

func _copy_params(source: ShaderMaterial, target: ShaderMaterial, keys: Array) -> void:
	for key in keys:
		target.set_shader_parameter(key, source.get_shader_parameter(key))

func _resize(stage: SubViewport, size: Vector2i) -> void:
	stage.size = size
	var rect := stage.get_node_or_null("Pass") as ColorRect
	if rect != null:
		rect.size = Vector2(size)

func _pass_material(stage: SubViewport) -> ShaderMaterial:
	return (stage.get_node("Pass") as ColorRect).material as ShaderMaterial

## Nothing but the passes' own output: no sky, ambient, glow or fog, and a linear tonemap (as MapEdges).
func _flat_environment() -> Environment:
	var environment := Environment.new()
	environment.background_mode = Environment.BG_CLEAR_COLOR
	environment.ambient_light_source = Environment.AMBIENT_SOURCE_DISABLED
	environment.reflected_light_source = Environment.REFLECTION_SOURCE_DISABLED
	environment.tonemap_mode = Environment.TONE_MAPPER_LINEAR
	return environment
