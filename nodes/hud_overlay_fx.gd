class_name HudOverlayFx extends Control
## Full-screen HUD overlays — ports of web WindupOverlay, the RespawnOverlay vignette and ScreenFlashes:
## shader vignettes that follow state, and tints that flash for the web durations (HudModel *_FLASH_MS).

const VIGNETTE_SHADER := preload("res://assets/shaders/hud_vignette.gdshader")
const MS_PER_S := 1000.0
const BYTE := 255.0
# WindupOverlay: radial-gradient(ellipse at center, transparent 50%, rgba(0,150,255,0.55) 100%), opacity = charge
const WINDUP_INNER := 0.5
const WINDUP_EDGE := Color(0.0, 150.0 / BYTE, 1.0, 0.55)
# RespawnOverlay: inset 0 0 160px rgba(120,180,255,0.45) + radial transparent 52% -> rgba(150,200,255,0.14)
const GHOST_INNER := 0.52
const GHOST_EDGE := Color(150.0 / BYTE, 200.0 / BYTE, 1.0, 0.14)
const GHOST_GLOW := Color(120.0 / BYTE, 180.0 / BYTE, 1.0, 0.45)
const GHOST_GLOW_PX := 160.0
# ScreenFlashes (shield up): inset 0 0 140px rgba(65,105,225,0.6) + 1px grid every 40px rgba(65,105,225,0.07)
const SHIELD_GLOW := Color(65.0 / BYTE, 105.0 / BYTE, 225.0 / BYTE, 0.6)
const SHIELD_GLOW_PX := 140.0
const SHIELD_GRID := Color(65.0 / BYTE, 105.0 / BYTE, 225.0 / BYTE, 0.07)
const SHIELD_GRID_PX := 40.0

const WINDUP_FADE_S := 0.07   # web WindupOverlay transition: opacity 70ms linear

var _windup_fade := CssTransition.new(WINDUP_FADE_S)
var _windup: ColorRect
var _shield: ColorRect
var _ghost: ColorRect
var _tints := {}   # node name -> {"rect": ColorRect, "duration_ms": float, "left_ms": float}

func _ready() -> void:
	name = "OverlayFx"
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_windup = _vignette("WindupVignette", {"edge_color": WINDUP_EDGE, "inner_stop": WINDUP_INNER})
	_shield = _vignette("ShieldVignette", {"grid_color": SHIELD_GRID, "grid_px": SHIELD_GRID_PX,
		"glow_color": SHIELD_GLOW, "glow_px": SHIELD_GLOW_PX})
	_ghost = _vignette("GhostVignette", {"edge_color": GHOST_EDGE, "inner_stop": GHOST_INNER,
		"glow_color": GHOST_GLOW, "glow_px": GHOST_GLOW_PX})
	_add_tint("BeamTint", HudModel.BEAM_TINT, HudModel.BEAM_FLASH_MS)
	_add_tint("HitTint", HudModel.PLAYER_HIT_TINT, HudModel.PLAYER_HIT_FLASH_MS)
	_add_tint("BlockTint", HudModel.SHIELD_BLOCK_TINT, HudModel.SHIELD_BLOCK_FLASH_MS)

## Windup vignette opacity follows the charge through the web `transition: opacity 70ms linear`; it mounts at the
## current value and is not drawn at zero (web renders null).
func set_windup(progress: float) -> void:
	var opacity := HudModel.windup_vignette_opacity(progress)
	if opacity <= 0.0:
		_windup_fade.snap(0.0)
		_windup.visible = false
		return
	if not _windup.visible:
		_windup_fade.snap(opacity)
	_windup_fade.set_target(opacity)
	_windup.visible = true
	_windup.modulate.a = _windup_fade.value

func set_ghost(active: bool) -> void:
	_ghost.visible = active

func set_shield_active(active: bool) -> void:
	_shield.visible = active

func flash_beam() -> void:
	_flash("BeamTint")

func flash_hit() -> void:
	_flash("HitTint")

func flash_block() -> void:
	_flash("BlockTint")

## Advance the flash timers (called every frame; exposed for deterministic tests).
func tick(delta: float) -> void:
	_windup_fade.advance(delta)
	if _windup.visible:
		_windup.modulate.a = _windup_fade.value
	for tint in _tints.values():
		if tint["left_ms"] <= 0.0:
			continue
		tint["left_ms"] -= delta * MS_PER_S
		if tint["left_ms"] <= 0.0:
			tint["rect"].visible = false

func _process(delta: float) -> void:
	tick(delta)

func _notification(what: int) -> void:
	if what == NOTIFICATION_RESIZED:
		for layer in [_windup, _shield, _ghost]:
			if layer != null:
				(layer.material as ShaderMaterial).set_shader_parameter("screen_px", size)

func _flash(node_name: String) -> void:
	var tint: Dictionary = _tints[node_name]
	tint["left_ms"] = tint["duration_ms"]
	tint["rect"].visible = true

func _vignette(node_name: String, params: Dictionary) -> ColorRect:
	var rect := _full_rect(node_name)
	rect.color = Color.WHITE
	var mat := ShaderMaterial.new()
	mat.shader = VIGNETTE_SHADER
	for key in params:
		mat.set_shader_parameter(key, params[key])
	rect.material = mat
	rect.visible = false
	add_child(rect)
	return rect

func _add_tint(node_name: String, color: Color, duration_ms: float) -> void:
	var rect := _full_rect(node_name)
	rect.color = color
	rect.visible = false
	add_child(rect)
	_tints[node_name] = {"rect": rect, "duration_ms": duration_ms, "left_ms": 0.0}

func _full_rect(node_name: String) -> ColorRect:
	var rect := ColorRect.new()
	rect.name = node_name
	rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
	rect.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	return rect
