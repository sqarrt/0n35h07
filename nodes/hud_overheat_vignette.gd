class_name HudOverheatVignette extends Control
## OVERHEAT HUD of the local player — port of web OverheatVignette: red inset edges pulsing by streak tier and
## lightning bolts flickering down both screen edges. Bolt strokes render into a mask viewport and glow through the web
## filter chain drop-shadow(0 0 2px #ff4a36) drop-shadow(0 0 5px #ff2a18) — Chrome blurs a drop-shadow of N px with
## sigma N (measured by parity-probe-drop-shadow.mjs, unlike box / text shadows) — and each bolt's region takes its own
## ov-strike opacity in the final composite. Viewports nest so each renders before the one sampling it.

const VIGNETTE_SHADER := preload("res://assets/shaders/hud_vignette.gdshader")
const BLUR_SHADER := preload("res://assets/shaders/glow_blur.gdshader")
const BOLTS_SHADER := preload("res://assets/shaders/overheat_bolts.gdshader")
const STROKE_COLOR := Color("#ffd9cc")
const NEAR_SHADOW_COLOR := Color("#ff4a36")
const FAR_SHADOW_COLOR := Color("#ff2a18")
const NEAR_SHADOW_SIGMA := 2.0
const FAR_SHADOW_SIGMA := 5.0
const KERNEL_SIGMAS := 3.0            # glow_blur reaches three sigmas
const MAX_BOLTS := 20                 # overheat_bolts.gdshader MAX_BOLTS
const HORIZONTAL := Vector2(1.0, 0.0)
const VERTICAL := Vector2(0.0, 1.0)
const HALF := 0.5
const FIXTURE_PERIOD_S := 1.0         # any: a frozen fixture never advances
const FIXTURE_STRIKE_PEAK := 0.04     # the ov-strike keyframe with opacity 1

## Draws every bolt stroke with round caps (SVG stroke-linecap: round) at full opacity.
class BoltCanvas extends Control:
	var strokes: Array = []   # [{"from", "to", "width"}] in screen pixels

	func _draw() -> void:
		for s in strokes:
			var radius: float = s["width"] * HudOverheatVignette.HALF
			draw_line(s["from"], s["to"], HudOverheatVignette.STROKE_COLOR, s["width"], true)
			draw_circle(s["from"], radius, HudOverheatVignette.STROKE_COLOR, true, -1.0, true)
			draw_circle(s["to"], radius, HudOverheatVignette.STROKE_COLOR, true, -1.0, true)

var rng: Callable                     # web Math.random; tests inject a fixed roll

var _tier := ""
var _pulse_s := 0.0                   # since the vignette mounted: React keeps the element across tier changes
var _bolts_s := 0.0                   # since the bolts were (re)created on the last tier change
var _bolts: Array = []                # OverheatFx.layout entries + "redraw_s" and the screen "rect"
var _vignette: ColorRect
var _canvas: BoltCanvas
var _viewports: Array[SubViewport] = []
var _rects: Array[TextureRect] = []
var _composite: TextureRect
var _frozen := false                  # a parity fixture holds its paused frame

func _init() -> void:
	rng = _roll

func _ready() -> void:
	name = "OverheatVignette"
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_vignette = ColorRect.new()
	_vignette.name = "Edges"
	_vignette.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_vignette.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	var edges := ShaderMaterial.new()
	edges.shader = VIGNETTE_SHADER
	_vignette.material = edges
	add_child(_vignette)
	_build_bolt_glow()
	visible = false
	_resize()

func tier() -> String:
	return _tier

func vignette() -> ColorRect:
	return _vignette

func bolt_count() -> int:
	return _bolts.size()

func stroke_count() -> int:
	return _canvas.strokes.size()

func bolt_opacities() -> PackedFloat32Array:
	var opacities := PackedFloat32Array()
	for bolt in _bolts:
		opacities.append(OverheatFx.strike_opacity(_bolts_s, bolt["dur_s"], bolt["delay_s"]))
	return opacities

## The local player's streak tier ("" hides). A new tier re-creates the bolts (web useEffect on the tier).
func set_tier(new_tier: String) -> void:
	if new_tier == _tier:
		return
	_frozen = false
	var shown := OverheatFx.has_tier(new_tier)
	if shown and not OverheatFx.has_tier(_tier):
		_pulse_s = 0.0
	_tier = new_tier
	visible = shown
	for viewport in _viewports:
		viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS if shown else SubViewport.UPDATE_DISABLED
	_bolts.clear()
	if not shown:
		return
	var shadow := OverheatFx.vignette_shadow(new_tier)
	var edges := _vignette.material as ShaderMaterial
	edges.set_shader_parameter("glow_color", shadow["color"])
	edges.set_shader_parameter("glow_px", shadow["blur_px"])
	edges.set_shader_parameter("glow_spread_px", shadow["spread_px"])
	_bolts = OverheatFx.layout(new_tier, rng)
	for bolt in _bolts:
		bolt["redraw_s"] = bolt["dur_s"]
	_bolts_s = 0.0
	_place_strokes()
	_apply()

## Advance the pulse, the strikes and the periodic reshaping (web setInterval(draw, dur)).
func tick(delta: float) -> void:
	if not visible or _frozen:
		return
	_pulse_s += delta
	_bolts_s += delta
	var reshaped := false
	for bolt in _bolts:
		while _bolts_s >= bolt["redraw_s"]:
			bolt["segments"] = OverheatFx.bolt_segments(bolt["length"], rng)
			bolt["redraw_s"] += bolt["dur_s"]
			reshaped = true
	if reshaped:
		_place_strokes()
	_apply()

## Parity fixture (tool-only): show exactly these bolts ({"side", "top_pct", "length", "segments"}) at the peak of their
## strike with the pulse at its start, and hold the frame — the web capture pauses every animation there.
func show_fixture(new_tier: String, bolts: Array) -> void:
	set_tier(new_tier)
	_bolts = []
	for bolt in bolts:
		var held: Dictionary = bolt.duplicate()
		held["dur_s"] = FIXTURE_PERIOD_S
		held["delay_s"] = 0.0
		held["redraw_s"] = INF
		_bolts.append(held)
	_bolts_s = FIXTURE_PERIOD_S * FIXTURE_STRIKE_PEAK
	_pulse_s = 0.0
	_frozen = true
	_place_strokes()
	_apply()

func _notification(what: int) -> void:
	if what == NOTIFICATION_RESIZED and _vignette != null:
		_resize()

func _apply() -> void:
	_vignette.modulate.a = OverheatFx.pulse_opacity(_pulse_s, OverheatFx.TIERS[_tier]["pulse"])
	var rects := PackedVector4Array()
	var opacities := bolt_opacities()
	for bolt in _bolts:
		var rect: Rect2 = bolt["rect"]
		rects.append(Vector4(rect.position.x, rect.position.y, rect.size.x, rect.size.y))
	rects.resize(MAX_BOLTS)
	opacities.resize(MAX_BOLTS)
	var composite := _composite.material as ShaderMaterial
	composite.set_shader_parameter("bolt_count", _bolts.size())
	composite.set_shader_parameter("bolt_rects", rects)
	composite.set_shader_parameter("bolt_opacity", opacities)

## Bolt strokes in screen pixels and each bolt's paint region (strokes plus both glows).
func _place_strokes() -> void:
	var strokes := []
	var reach := KERNEL_SIGMAS * (NEAR_SHADOW_SIGMA + FAR_SHADOW_SIGMA)
	for bolt in _bolts:
		var region := Rect2()
		var first := true
		for s in bolt["segments"]:
			var from := OverheatFx.to_screen(bolt, s["from"], size)
			var to := OverheatFx.to_screen(bolt, s["to"], size)
			strokes.append({"from": from, "to": to, "width": s["width"]})
			var piece := Rect2(from, Vector2.ZERO).expand(to).grow(s["width"])
			region = piece if first else region.merge(piece)
			first = false
		bolt["rect"] = region.grow(reach)
	_canvas.strokes = strokes
	_canvas.queue_redraw()

func _build_bolt_glow() -> void:
	var mask := _viewport("BoltMask")
	_canvas = BoltCanvas.new()
	_canvas.name = "Strokes"
	mask.add_child(_canvas)
	var near_h := _viewport("NearShadowH")
	near_h.add_child(mask)
	near_h.add_child(_blur(mask.get_texture(), HORIZONTAL, NEAR_SHADOW_SIGMA, Color.WHITE))
	var near := _viewport("NearShadow")
	near.add_child(near_h)
	near.add_child(_blur(near_h.get_texture(), VERTICAL, NEAR_SHADOW_SIGMA, NEAR_SHADOW_COLOR))
	near.add_child(_premultiplied(mask.get_texture()))
	var far_h := _viewport("FarShadowH")
	far_h.add_child(near)
	far_h.add_child(_blur(near.get_texture(), HORIZONTAL, FAR_SHADOW_SIGMA, Color.WHITE))
	var glow := _viewport("BoltGlow")
	glow.add_child(far_h)
	glow.add_child(_blur(far_h.get_texture(), VERTICAL, FAR_SHADOW_SIGMA, FAR_SHADOW_COLOR))
	glow.add_child(_premultiplied(near.get_texture()))
	add_child(glow)
	_composite = _texture_rect("Bolts", glow.get_texture())
	var composite := ShaderMaterial.new()
	composite.shader = BOLTS_SHADER
	_composite.material = composite
	add_child(_composite)

func _resize() -> void:
	var pixels := Vector2i(size.ceil())
	if pixels.x <= 0 or pixels.y <= 0:
		return
	for viewport in _viewports:
		viewport.size = pixels
	for rect in _rects:
		rect.size = Vector2(pixels)
	_canvas.size = Vector2(pixels)
	_composite.size = Vector2(pixels)
	(_vignette.material as ShaderMaterial).set_shader_parameter("screen_px", size)
	(_composite.material as ShaderMaterial).set_shader_parameter("screen_px", size)
	if not _bolts.is_empty():
		_place_strokes()
		_apply()

func _viewport(node_name: String) -> SubViewport:
	var viewport := SubViewport.new()
	viewport.name = node_name
	viewport.transparent_bg = true
	viewport.disable_3d = true
	viewport.gui_disable_input = true
	viewport.render_target_update_mode = SubViewport.UPDATE_DISABLED
	_viewports.append(viewport)
	return viewport

func _texture_rect(node_name: String, source: Texture2D) -> TextureRect:
	var rect := TextureRect.new()
	rect.name = node_name
	rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
	rect.texture = source
	rect.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	rect.stretch_mode = TextureRect.STRETCH_SCALE
	rect.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	_rects.append(rect)
	return rect

## One separable blur pass of the source alpha in a shadow colour (glow_blur.gdshader).
func _blur(source: Texture2D, direction: Vector2, sigma: float, tint: Color) -> TextureRect:
	var rect := _texture_rect("Blur", source)
	var material := ShaderMaterial.new()
	material.shader = BLUR_SHADER
	material.set_shader_parameter("direction", direction)
	material.set_shader_parameter("sigma", sigma)
	material.set_shader_parameter("tint", tint)
	rect.material = material
	return rect

## A viewport texture drawn over its shadow: transparent viewports hold premultiplied colour.
func _premultiplied(source: Texture2D) -> TextureRect:
	var rect := _texture_rect("Source", source)
	var material := CanvasItemMaterial.new()
	material.blend_mode = CanvasItemMaterial.BLEND_MODE_PREMULT_ALPHA
	rect.material = material
	return rect

func _roll() -> float:
	return randf()
