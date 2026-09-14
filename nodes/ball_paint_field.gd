class_name BallPaintField extends Control
## A round artwork field — port of web ui/BallPaintField: its 0.6rem caption, a 132 px canvas of 16×16 cells (paper
## #cdd6f0 cells, painted cells black, 1 px gaps and everything outside the disc #0b1020, drawn at the canvas's
## fractional 8.25 px steps with Skia's partial coverage, the whole canvas clipped to a circle) and a CLEAR segment,
## the three centred 0.4rem apart. Press and drag inside the disc to paint (or erase) cells.

signal painted(cx: int, cy: int, value: int)
signal cleared

const FIELD_PX := 132                      # FIELD_PX
const CELL_PX := float(FIELD_PX) / BallArt.SIZE
const CELL_GAP := 1.0                      # fillRect(…, CELL - 1, CELL - 1)
const GAP := 6.4                           # gap 0.4rem
const CAPTION_PX := 9.6                    # 0.6rem, spaced 0.15em, #556
const CAPTION_SPACING_EM := 0.15
const BACKGROUND := Color("#0b1020")       # COL_BG
const INK := Color("#000000")              # COL_INK
const PAPER := Color("#cdd6f0")            # COL_PAPER
const CLEAR_TEXT := "CLEAR"                # web en appearPaintClear
const HALF := 0.5

var grid := PackedByteArray()
var erasing := false

var _caption: Label
var _field: TextureRect
var _clear: SegButton
var _image: Image
var _texture: ImageTexture
var _drawing := false

func _init(caption := "", cells := PackedByteArray()) -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	_caption = MenuText.label("Caption", caption, CAPTION_PX, CAPTION_SPACING_EM, MenuText.FIELD_COLOR)
	add_child(_caption)
	_image = Image.create_empty(FIELD_PX, FIELD_PX, false, Image.FORMAT_RGBA8)
	_texture = ImageTexture.create_from_image(_image)
	_field = TextureRect.new()
	_field.name = "Field"
	_field.texture = _texture
	_field.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	_field.mouse_filter = Control.MOUSE_FILTER_STOP
	_field.mouse_default_cursor_shape = Control.CURSOR_CROSS
	_field.gui_input.connect(_on_field_input)
	_field.mouse_exited.connect(func() -> void: _drawing = false)
	add_child(_field)
	_clear = SegButton.new(CLEAR_TEXT)
	_clear.name = "Clear"
	_clear.pressed.connect(func() -> void: cleared.emit())
	add_child(_clear)
	set_grid(cells)
	resized.connect(_layout)

## Show a side's cells (the parent owns the grid and calls again after each change).
func set_grid(cells: PackedByteArray) -> void:
	grid = cells if cells.size() == BallArt.CELLS else BallArt.empty()[BallArt.FRONT]
	_render()

func field() -> TextureRect:
	return _field

func image() -> Image:
	return _image

func _get_minimum_size() -> Vector2:
	return Vector2(FIELD_PX, _field_top() + FIELD_PX + GAP + _clear.get_combined_minimum_size().y)

func _field_top() -> float:
	return _caption.get_combined_minimum_size().y + GAP

func _layout() -> void:
	var width := size.x
	var caption := _caption.get_combined_minimum_size()
	_caption.position = Vector2((width - caption.x) * HALF, 0.0)
	_caption.size = caption
	_field.position = Vector2((width - FIELD_PX) * HALF, _field_top())
	_field.size = Vector2(FIELD_PX, FIELD_PX)
	var clear := _clear.get_combined_minimum_size()
	_clear.position = Vector2((width - clear.x) * HALF, _field_top() + FIELD_PX + GAP)
	_clear.size = clear

## web paintCanvas: the background, then each disc cell at its fractional step with partial pixel coverage, then the
## border-radius clip.
func _render() -> void:
	_image.fill(BACKGROUND)
	var size_px := CELL_PX - CELL_GAP
	for cy in BallArt.SIZE:
		for cx in BallArt.SIZE:
			if not BallArt.cell_in_disc(cx, cy):
				continue
			var ink := INK if grid[cy * BallArt.SIZE + cx] != 0 else PAPER
			_fill_rect(cx * CELL_PX, cy * CELL_PX, size_px, ink)
	var radius := FIELD_PX * HALF
	for py in FIELD_PX:
		for px in FIELD_PX:
			var d := Vector2(px + HALF - radius, py + HALF - radius).length()
			var coverage := clampf(radius - d + HALF, 0.0, 1.0)
			if coverage < 1.0:
				var pixel := _image.get_pixel(px, py)
				pixel.a *= coverage
				_image.set_pixel(px, py, pixel)
	_texture.update(_image)

## A square at a fractional position blended over the pixels it covers (canvas fillRect anti-aliasing).
func _fill_rect(left: float, top: float, extent: float, ink: Color) -> void:
	for py in range(floori(top), ceili(top + extent)):
		var cover_y := minf(py + 1.0, top + extent) - maxf(py, top)
		for px in range(floori(left), ceili(left + extent)):
			var cover := (minf(px + 1.0, left + extent) - maxf(px, left)) * cover_y
			if cover > 0.0:
				_image.set_pixel(px, py, _image.get_pixel(px, py).lerp(ink, cover))

func _on_field_input(event: InputEvent) -> void:
	var button := event as InputEventMouseButton
	if button != null and button.button_index == MOUSE_BUTTON_LEFT:
		_drawing = button.pressed
		if _drawing:
			_paint_at(button.position)
		return
	var motion := event as InputEventMouseMotion
	if motion != null and _drawing:
		_paint_at(motion.position)

func _paint_at(point: Vector2) -> void:
	var cx := floori(point.x / FIELD_PX * BallArt.SIZE)
	var cy := floori(point.y / FIELD_PX * BallArt.SIZE)
	if cx < 0 or cy < 0 or cx >= BallArt.SIZE or cy >= BallArt.SIZE or not BallArt.cell_in_disc(cx, cy):
		return
	painted.emit(cx, cy, 0 if erasing else 1)
