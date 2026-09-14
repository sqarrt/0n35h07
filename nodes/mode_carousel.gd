class_name ModeCarousel extends Control
## Mode preset carousel — port of web components/lobby/ModeCarousel: the selected tile centred (accent border, faint
## accent fill, glowing name), its cyclic neighbours at the sides one tile away, scaled .86 and dimmed to .45 (.85
## under the mouse); switching eases transform and opacity over .25 s so the strip never changes height.

signal mode_picked(mode: String)

const HEIGHT := 88.0
const TILE_HEIGHT := 68.0
const TILE_SHARE := 0.3334                     # width: 33.34%
const SIDE_SCALE := 0.86
const SIDE_OPACITY := 0.45
const SIDE_HOVER_OPACITY := 0.85
const LOCKED_OPACITY := 0.55
const TILE_BORDER := Color("#333344")
const CENTER_BACKGROUND := Color(68.0 / 255.0, 170.0 / 255.0, 1.0, 0.08)
const NAME_FONT_SIZE := 24
const NAME_SPACING_EM := 0.24                  # and a left pad of the same, so the tracked caps sit centred
const NAME_GLOW_BLUR := 20.0
const NAME_GLOW := Color(68.0 / 255.0, 170.0 / 255.0, 1.0, 0.55)
const TRANSITION_S := 0.25
const ROLE_LEFT := -1
const ROLE_CENTER := 0
const ROLE_RIGHT := 1
const HALF := 0.5

## One tile: its box follows the role, the name is a GlowText centred inside.
class Tile extends Button:
	var mode := ""
	var role := ModeCarousel.ROLE_CENTER
	var name_text: GlowText

	func _draw() -> void:
		var box := StyleBoxFlat.new()
		var center := role == ModeCarousel.ROLE_CENTER
		box.bg_color = ModeCarousel.CENTER_BACKGROUND if center else UiTokens.BG
		box.border_color = UiTokens.ACCENT if center else (UiTokens.ACCENT_DIM if is_hovered() and not disabled
			else ModeCarousel.TILE_BORDER)
		box.set_border_width_all(1)
		box.anti_aliasing = false
		draw_style_box(box, Rect2(Vector2.ZERO, size))

var _mode := GameModes.DUEL
var _enabled := true
var _tiles := {}

func _ready() -> void:
	custom_minimum_size.y = HEIGHT
	for mode in GameModes.GAME_MODES:
		var tile := Tile.new()
		tile.name = "Tile%s" % GameModes.label(mode)
		tile.mode = mode
		tile.focus_mode = Control.FOCUS_NONE
		for state in ["normal", "hover", "pressed", "hover_pressed", "focus", "disabled"]:
			tile.add_theme_stylebox_override(state, StyleBoxEmpty.new())
		add_child(tile)
		var label := GlowText.new()
		label.name = "Name"
		label.mouse_filter = Control.MOUSE_FILTER_IGNORE
		tile.add_child(label)
		var font := UiFont.with_css_line(UiFont.spaced(NAME_SPACING_EM, NAME_FONT_SIZE), NAME_FONT_SIZE)
		var pads := UiFont.trailing_spacing_style(font)
		pads.content_margin_left = font.spacing_glyph
		label.label().add_theme_stylebox_override("normal", pads)
		label.mask_label().add_theme_stylebox_override("normal", pads)
		label.configure(font, NAME_FONT_SIZE, UiTokens.TEXT)
		label.set_text(GameModes.label(mode).to_upper())
		tile.name_text = label
		tile.pressed.connect(func() -> void: _pick(mode))
		tile.mouse_entered.connect(_refresh_tile.bind(tile))
		tile.mouse_exited.connect(_refresh_tile.bind(tile))
		_tiles[mode] = tile
	resized.connect(_place.bind(false))
	_place(false)

func tile(mode: String) -> Button:
	return _tiles[mode]

func set_mode(mode: String, animate := true) -> void:
	_mode = mode
	_place(animate)

func set_enabled(enabled: bool) -> void:
	_enabled = enabled
	modulate.a = 1.0 if enabled else LOCKED_OPACITY
	for mode in _tiles:
		(_tiles[mode] as Tile).disabled = not enabled

func role_of(mode: String) -> int:
	var index := GameModes.GAME_MODES.find(_mode)
	if mode == _mode:
		return ROLE_CENTER
	return ROLE_RIGHT if mode == GameModes.GAME_MODES[(index + 1) % GameModes.GAME_MODES.size()] else ROLE_LEFT

func _pick(mode: String) -> void:
	if not _enabled or mode == _mode:
		return
	mode_picked.emit(mode)

func _place(animate: bool) -> void:
	if _tiles.is_empty():
		return
	var tile_size := Vector2(size.x * TILE_SHARE, TILE_HEIGHT)
	for mode in _tiles:
		var tile: Tile = _tiles[mode]
		tile.role = role_of(mode)
		tile.size = tile_size
		tile.pivot_offset = tile_size * HALF
		var centre := Vector2(size.x * HALF + tile.role * tile_size.x, size.y * HALF)
		var target_position := centre - tile_size * HALF
		var target_scale := Vector2.ONE * (1.0 if tile.role == ROLE_CENTER else SIDE_SCALE)
		var target_alpha := _opacity(tile)
		if animate:
			var tween := tile.create_tween().set_parallel(true).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
			tween.tween_property(tile, "position", target_position, TRANSITION_S)
			tween.tween_property(tile, "scale", target_scale, TRANSITION_S)
			tween.tween_property(tile, "modulate:a", target_alpha, TRANSITION_S)
		else:
			tile.position = target_position
			tile.scale = target_scale
			tile.modulate.a = target_alpha
		_style_name(tile)
		tile.queue_redraw()
		var name_box := tile.name_text.get_combined_minimum_size()
		tile.name_text.size = name_box
		tile.name_text.position = (tile_size - name_box) * HALF

func _opacity(tile: Tile) -> float:
	if tile.role == ROLE_CENTER:
		return 1.0
	return SIDE_HOVER_OPACITY if tile.is_hovered() and _enabled else SIDE_OPACITY

func _style_name(tile: Tile) -> void:
	var center := tile.role == ROLE_CENTER
	tile.name_text.set_color(UiTokens.ACCENT if center else UiTokens.TEXT)
	tile.name_text.set_shadows([CssShadow.make(NAME_GLOW_BLUR, NAME_GLOW)] if center else [])

func _refresh_tile(tile: Tile) -> void:
	tile.modulate.a = _opacity(tile)
	tile.queue_redraw()
