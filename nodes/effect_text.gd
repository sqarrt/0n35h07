class_name EffectText extends Control
## Kill-streak text — port of web EffectText.tsx + theme.css `.fx` rules, used by the HUD name and the streak banner.
## No kind: a plain label (the `.nm` look). With a kind, one SubViewport composites the glowing text (GlowText), the
## chroma-split glitch copies (tiers), the sparks and tick marks; the result is shown through the SVG turbulence filter
## (tiers) and the element animation (flick / jitter / burn). SINGULARITY corrupts its characters every 240 ms.

const ARC_SHADER := preload("res://assets/shaders/glow_arc.gdshader")
const TICK_SHADER := preload("res://assets/shaders/glow_rect.gdshader")
const FILTER_SHADER := preload("res://assets/shaders/text_turbulence.gdshader")
const GLITCH_A_COLOR := Color("#55ffff")     # web .glitch-a: #5ff with text-shadow -1px 0 #5ff
const GLITCH_B_COLOR := Color("#ff66aa")     # web .glitch-b: #f6a with text-shadow 1px 0 #f6a
const GLITCH_A_SHADOW_X := -1
const GLITCH_B_SHADOW_X := 1
const TICK_COLOR := Color.WHITE              # web .tick background #fff
const MS_PER_S := 1000.0
const TIME_EPS_MS := 0.001                   # float slack when an interval boundary lands exactly on a tick

var _plain: Label
var _composite: SubViewport
var _glow: GlowText
var _display: TextureRect
var _glitches: Array[Control] = []
var _arcs: Array[ColorRect] = []
var _ticks: Array[ColorRect] = []
var _font: Font
var _font_size := 0
var _kind := ""
var _style := {}
var _text := ""
var _shown := ""
var _player_color := Color.WHITE
var _elapsed := 0.0
var _scramble_tick := 0
var _scrambled := ""
var _random := RandomNumberGenerator.new()
var _rng: Callable
## Advance the animations every frame; owners that drive time themselves (the banner's tick) turn it off.
var auto_advance := true

func _init() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	_random.randomize()
	_rng = _random.randf
	_plain = Label.new()
	_plain.name = "Plain"
	_plain.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_plain.minimum_size_changed.connect(_on_plain_size_changed)   # fonts reshape after the theme settles
	add_child(_plain)
	_composite = SubViewport.new()
	_composite.name = "Composite"
	_composite.transparent_bg = true
	_composite.disable_3d = true
	_composite.gui_disable_input = true
	_composite.render_target_update_mode = SubViewport.UPDATE_DISABLED
	add_child(_composite)
	_glow = GlowText.new()
	_glow.name = "Glow"
	_composite.add_child(_glow)
	_display = TextureRect.new()
	_display.name = "Display"
	_display.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_display.texture = _composite.get_texture()
	_display.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_display.stretch_mode = TextureRect.STRETCH_SCALE
	_display.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR
	var filter := ShaderMaterial.new()
	filter.shader = FILTER_SHADER
	_display.material = filter
	_display.visible = false
	add_child(_display)

## Font (with the caller's letter-spacing), size and the plain-text colour.
func configure(font: Font, font_size: int, plain_color: Color) -> void:
	_font = font
	_font_size = font_size
	_plain.add_theme_font_override("font", font)
	_plain.add_theme_font_size_override("font_size", font_size)
	_plain.add_theme_color_override("font_color", plain_color)
	_glow.configure(font, font_size, Color.WHITE)

## Show `text` with a streak kind ("" = plain) in the player's colour; restarts the animations (web re-mounts).
func show_text(text: String, kind: String, player_color: Color) -> void:
	_text = text
	_shown = text
	_kind = kind
	_style = StreakFx.style(kind)
	_player_color = player_color
	_elapsed = 0.0
	_scramble_tick = 0
	_plain.text = text
	var fx := not _style.is_empty()
	_plain.visible = not fx
	_display.visible = fx
	_composite.render_target_update_mode = SubViewport.UPDATE_ALWAYS if fx else SubViewport.UPDATE_DISABLED
	_clear_decor()
	if not fx:
		custom_minimum_size = _plain.get_minimum_size()
		return
	_glow.set_color(StreakFx.text_color(kind, player_color))
	_build_decor()
	_apply()

func advance(delta: float) -> void:
	if _style.is_empty():
		return
	_elapsed += delta
	_apply()

## Inject the scramble random source (tests); defaults to a randomised RandomNumberGenerator.
func set_rng(rng: Callable) -> void:
	_rng = rng

func shown_text() -> String:
	return _shown

## The text as given (shown_text() may be momentarily scrambled).
func base_text() -> String:
	return _text

func kind() -> String:
	return _kind

func elapsed() -> float:
	return _elapsed

func plain_label() -> Label:
	return _plain

func display() -> TextureRect:
	return _display

func glow() -> GlowText:
	return _glow

func glitch_copies() -> Array[Control]:
	return _glitches

func arcs() -> Array[ColorRect]:
	return _arcs

func ticks() -> Array[ColorRect]:
	return _ticks

func _on_plain_size_changed() -> void:
	if _style.is_empty():
		custom_minimum_size = _plain.get_minimum_size()

func _process(delta: float) -> void:
	if auto_advance:
		advance(delta)

func _apply() -> void:
	_update_scramble()
	_glow.set_text(_shown)
	_glow.set_shadows(StreakFx.text_shadows(_kind, _player_color, _elapsed))
	var box := _glow.get_combined_minimum_size()
	custom_minimum_size = box
	var pad := maxi(_glow.padding(), StreakFx.ARC_REACH_PX)
	var origin := Vector2.ONE * pad
	var composite_size := Vector2i(box.ceil()) + Vector2i.ONE * 2 * pad
	if _composite.size != composite_size:
		_composite.size = composite_size
	_glow.position = origin
	_apply_glitches(origin, box)
	_apply_sparks(origin, box)
	_apply_element(origin, box, composite_size)

func _apply_glitches(origin: Vector2, box: Vector2) -> void:
	if _glitches.is_empty():
		return
	var periods: Array = _style["glitch_periods_s"]
	var bands := [StreakFx.glitch_band_a(_elapsed, periods[0]), StreakFx.glitch_band_b(_elapsed, periods[1])]
	for i in _glitches.size():
		var band: Dictionary = bands[i]
		var clip := _glitches[i]
		var top: float = band["top"] * box.y
		clip.position = origin + Vector2(band["shift_px"], top)
		clip.size = Vector2(box.x, maxf(0.0, box.y * (1.0 - band["top"] - band["bottom"])))
		var copy := clip.get_child(0) as Label
		copy.text = _shown
		copy.position = Vector2(0.0, -top)
		copy.size = box

func _apply_sparks(origin: Vector2, box: Vector2) -> void:
	for i in _arcs.size():
		var arc_spec: Dictionary = StreakFx.ARCS[i]
		var arc := _arcs[i]
		var arc_pad: float = (arc.material as ShaderMaterial).get_shader_parameter("pad_px")
		arc.position = origin + StreakFx.arc_position(i, box) - Vector2.ONE * arc_pad
		arc.modulate.a = StreakFx.crack_opacity(_elapsed, arc_spec["period_s"], arc_spec["delay_s"])
	for i in _ticks.size():
		var tick_spec: Dictionary = StreakFx.TICKS[i]
		var tick := _ticks[i]
		var tick_pad: float = (tick.material as ShaderMaterial).get_shader_parameter("pad_px")
		tick.position = origin + StreakFx.tick_position(i, box) - Vector2.ONE * tick_pad
		tick.modulate.a = StreakFx.tick_opacity(_elapsed, tick_spec["period_s"], tick_spec["delay_s"])

func _apply_element(origin: Vector2, box: Vector2, composite_size: Vector2i) -> void:
	var offset := Vector2.ZERO
	var scale_factor := 1.0
	var opacity := 1.0
	match _style["anim"]:
		StreakFx.ANIM_FLICK:
			opacity = StreakFx.flick_opacity(_elapsed)
		StreakFx.ANIM_JITTER:
			offset = StreakFx.jitter_offset(_elapsed)
		StreakFx.ANIM_BURN:
			var burn := StreakFx.burn_transform(_elapsed)
			offset = burn["offset"]
			scale_factor = burn["scale"]
	_display.size = Vector2(composite_size)
	_display.position = -origin + offset
	_display.pivot_offset = origin + box / 2.0
	_display.scale = Vector2.ONE * scale_factor
	_display.modulate.a = opacity
	var filter := _display.material as ShaderMaterial
	var settings := StreakFx.filter_at(_kind, _elapsed)
	filter.set_shader_parameter("scale_px", settings.get("scale", 0.0))
	filter.set_shader_parameter("base_frequency", settings.get("frequency", Vector2.ZERO))
	filter.set_shader_parameter("octaves", settings.get("octaves", 1))
	filter.set_shader_parameter("seed", float(settings.get("seed", 0)))
	filter.set_shader_parameter("box_origin_px", origin)
	var region := StreakFx.filter_region(Rect2(origin, box), StreakFx.text_shadows(_kind, _player_color, _elapsed))
	filter.set_shader_parameter("region_origin_px", region.position)
	filter.set_shader_parameter("region_size_px", region.size)

func _update_scramble() -> void:
	if not _style.get("scramble", false):
		_shown = _text
		return
	var ms := _elapsed * MS_PER_S
	var tick := floori((ms + TIME_EPS_MS) / StreakFx.SCRAMBLE_MS)
	var since := ms - tick * StreakFx.SCRAMBLE_MS
	if tick >= 1 and since < StreakFx.SCRAMBLE_FLASH_MS - TIME_EPS_MS:
		if tick != _scramble_tick:
			_scramble_tick = tick
			_scrambled = StreakFx.scramble(_text, _rng)
		_shown = _scrambled
	else:
		_shown = _text

func _build_decor() -> void:
	if _style["glitch"]:
		_glitches.append(_glitch_copy("GlitchA", GLITCH_A_COLOR, GLITCH_A_SHADOW_X))
		_glitches.append(_glitch_copy("GlitchB", GLITCH_B_COLOR, GLITCH_B_SHADOW_X))
	var arc_sigma := CssShadow.sigma(StreakFx.ARC_GLOW_BLUR)
	var arc_pad := float(CssShadow.reach_px(CssShadow.make(StreakFx.ARC_GLOW_BLUR, Color.WHITE)))
	for i in int(_style["arcs"]):
		var width: float = StreakFx.ARCS[i]["width"]
		var arc := _shader_rect("Arc%d" % i, ARC_SHADER, Vector2(width, StreakFx.ARC_HEIGHT_PX) + Vector2.ONE * 2.0 * arc_pad)
		var material := arc.material as ShaderMaterial
		material.set_shader_parameter("length_px", width)
		material.set_shader_parameter("pad_px", arc_pad)
		material.set_shader_parameter("sigma", arc_sigma)
		material.set_shader_parameter("player_color", _player_color)
		arc.pivot_offset = arc.size / 2.0
		arc.rotation = deg_to_rad(StreakFx.ARCS[i]["angle_deg"])
		_arcs.append(arc)
	var tick_pad := float(CssShadow.reach_px(CssShadow.make(StreakFx.TICK_GLOW_BLUR, Color.WHITE)))
	for i in int(_style["ticks"]):
		var tick := _shader_rect("Tick%d" % i, TICK_SHADER, StreakFx.TICK_SIZE_PX + Vector2.ONE * 2.0 * tick_pad)
		var material := tick.material as ShaderMaterial
		material.set_shader_parameter("box_px", StreakFx.TICK_SIZE_PX)
		material.set_shader_parameter("pad_px", tick_pad)
		material.set_shader_parameter("sigma", CssShadow.sigma(StreakFx.TICK_GLOW_BLUR))
		material.set_shader_parameter("core_color", TICK_COLOR)
		material.set_shader_parameter("glow_color", _player_color)
		_ticks.append(tick)

func _clear_decor() -> void:
	for node in _glitches + _arcs + _ticks:
		_composite.remove_child(node)
		node.queue_free()
	_glitches.clear()
	_arcs.clear()
	_ticks.clear()

func _glitch_copy(node_name: String, color: Color, shadow_x: int) -> Control:
	var clip := Control.new()
	clip.name = node_name
	clip.clip_contents = true
	clip.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var copy := Label.new()
	copy.mouse_filter = Control.MOUSE_FILTER_IGNORE
	copy.add_theme_font_override("font", _font)
	copy.add_theme_font_size_override("font_size", _font_size)
	copy.add_theme_color_override("font_color", color)
	copy.add_theme_color_override("font_shadow_color", color)
	copy.add_theme_constant_override("shadow_offset_x", shadow_x)
	copy.add_theme_constant_override("shadow_offset_y", 0)
	copy.add_theme_constant_override("shadow_outline_size", 0)
	clip.add_child(copy)
	_composite.add_child(clip)
	return clip

func _shader_rect(node_name: String, shader: Shader, rect_size: Vector2) -> ColorRect:
	var rect := ColorRect.new()
	rect.name = node_name
	rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
	rect.size = rect_size
	var material := ShaderMaterial.new()
	material.shader = shader
	rect.material = material
	_composite.add_child(rect)
	return rect
