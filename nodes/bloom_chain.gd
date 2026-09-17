class_name BloomChain extends Node
## postprocessing BloomEffect with the mipmap blur, as a chain of float viewports — each nested inside the one that
## reads it, so it renders first in a frame:
##   Up0 ⊃ Up1 ⊃ … ⊃ Up6 ⊃ Down7 ⊃ … ⊃ Down0 ⊃ Luminance ⊃ (the adopted source)
## Luminance keeps what is brighter than the threshold (LuminancePass), the Down / Up mips blur it (MipmapBlurPass);
## `texture()` is the bloom to blend over the scene at the effect's intensity. The stages render only while active.

const LUMINANCE_SHADER := preload("res://assets/shaders/bloom_luminance.gdshader")
const DOWNSAMPLE_SHADER := preload("res://assets/shaders/bloom_downsample.gdshader")
const UPSAMPLE_SHADER := preload("res://assets/shaders/bloom_upsample.gdshader")
const LEVELS := 8                                    # MipmapBlurPass levels (BloomEffect default)
const PASS := "Pass"
const HALF := 0.5

var _luminance: SubViewport
var _down: Array[SubViewport] = []
var _up: Array[SubViewport] = []
var _stages: Array[SubViewport] = []                 # outer → inner

## The bright-pass threshold and smoothing, and the blur's radius (BloomEffect luminanceThreshold / luminanceSmoothing /
## radius).
func _init(threshold: float, smoothing: float, radius: float) -> void:
	name = "Bloom"
	var outer: Node = self
	for i in LEVELS - 1:
		outer = add_stage(outer, "Up%d" % i, UPSAMPLE_SHADER, _stages)
		_up.append(outer)
	_down.resize(LEVELS)
	for i in range(LEVELS - 1, -1, -1):
		outer = add_stage(outer, "Down%d" % i, DOWNSAMPLE_SHADER, _stages)
		_down[i] = outer
	_luminance = add_stage(outer, "Luminance", LUMINANCE_SHADER, _stages)
	var luminance := pass_material(_luminance)
	luminance.set_shader_parameter("threshold", threshold)
	luminance.set_shader_parameter("smoothing", smoothing)
	for i in LEVELS:
		pass_material(_down[i]).set_shader_parameter("source", _down_source(i).get_texture())
	for i in _up.size():
		var material := pass_material(_up[i])
		material.set_shader_parameter("source", _up_source(i).get_texture())
		material.set_shader_parameter("support", _down[i].get_texture())
		material.set_shader_parameter("radius", radius)

## Put the scene's viewport (or the stage that produces it) innermost, so it renders before the whole chain.
func adopt(source: Node) -> void:
	_luminance.add_child(source)

## The texture the bright-pass reads.
func set_source(texture: Texture2D) -> void:
	pass_material(_luminance).set_shader_parameter("source", texture)

## Luminance at the screen size, the mips halved like postprocessing (Math.round of half), texel sizes to match.
func set_size(screen: Vector2i) -> void:
	resize(_luminance, screen)
	var mip := screen
	for i in LEVELS:
		mip = Vector2i(maxi(floori(mip.x * HALF + HALF), 1), maxi(floori(mip.y * HALF + HALF), 1))
		resize(_down[i], mip)
		if i < _up.size():
			resize(_up[i], mip)
	for i in LEVELS:
		pass_material(_down[i]).set_shader_parameter("texel", Vector2.ONE / Vector2(_down_source(i).size))
	for i in _up.size():
		pass_material(_up[i]).set_shader_parameter("texel", Vector2.ONE / Vector2(_up_source(i).size))

## The bright-pass threshold while running (web luminanceMaterial.threshold: the Radio screen's soft bloom morphs it).
func set_threshold(value: float) -> void:
	pass_material(_luminance).set_shader_parameter("threshold", value)

## The blur's radius while running (web mipmapBlurPass.radius).
func set_radius(value: float) -> void:
	for stage in _up:
		pass_material(stage).set_shader_parameter("radius", value)

func set_active(on: bool) -> void:
	var mode := SubViewport.UPDATE_ALWAYS if on else SubViewport.UPDATE_DISABLED
	for stage in _stages:
		stage.render_target_update_mode = mode

## The blurred bright parts at the screen size.
func texture() -> Texture2D:
	return _up[0].get_texture()

func stages() -> Array[SubViewport]:
	return _stages

func luminance_viewport() -> SubViewport:
	return _luminance

func down(level: int) -> SubViewport:
	return _down[level]

func up(level: int) -> SubViewport:
	return _up[level]

## A float 2D stage: one full-size rect running `shader`, nested in `outer` and listed in `into`.
static func add_stage(outer: Node, stage_name: String, shader: Shader, into: Array[SubViewport]) -> SubViewport:
	var stage := SubViewport.new()
	stage.name = stage_name
	stage.use_hdr_2d = true
	stage.transparent_bg = true
	stage.disable_3d = true
	stage.render_target_update_mode = SubViewport.UPDATE_DISABLED
	var rect := ColorRect.new()
	rect.name = PASS
	var material := ShaderMaterial.new()
	material.shader = shader
	rect.material = material
	stage.add_child(rect)
	outer.add_child(stage)
	into.append(stage)
	return stage

static func resize(stage: SubViewport, size: Vector2i) -> void:
	stage.size = size
	var rect := stage.get_node_or_null(PASS) as ColorRect
	if rect != null:
		rect.size = Vector2(size)

static func pass_material(stage: SubViewport) -> ShaderMaterial:
	return (stage.get_node(PASS) as ColorRect).material as ShaderMaterial

func _down_source(level: int) -> SubViewport:
	return _luminance if level == 0 else _down[level - 1]

func _up_source(level: int) -> SubViewport:
	return _down[LEVELS - 1] if level == _up.size() - 1 else _up[level + 1]
