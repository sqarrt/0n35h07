class_name BallArt
## Ball artwork — port of web ballArt.ts (two 16×16 one-bit sides, bit i of byte b = cell b*8+i, base64 of the 64
## bytes; only cells whose centre lies inside the inscribed circle can be painted) and artTexture.ts writeArtData: a
## 32×16 luminance layout, front|back, painted cells 0 (black multiplier), empty 255, rows flipped so the editor's top
## row is the ball's top. A side grid is a PackedByteArray of SIZE × SIZE cells, 1 painted.

const SIZE := 16
const CELLS := SIZE * SIZE
const TEX_W := SIZE * 2
const TEX_H := SIZE
const BITS_PER_BYTE := 8
const BYTES_PER_SIDE := AppearanceConst.BALL_ART_BYTES >> 1   # front and back halves
const PAINTED := 0
const EMPTY := 255
const FRONT := "front"
const BACK := "back"
const HALF_CELL := 0.5
const DISC_RADIUS := SIZE * 0.5

## Two empty sides (web makeEmptyArt).
static func empty() -> Dictionary:
	var front := PackedByteArray()
	front.resize(CELLS)
	var back := PackedByteArray()
	back.resize(CELLS)
	return {FRONT: front, BACK: back}

## The sides of a stored artwork (web decodeBallArt); an invalid string gives empty sides.
static func decode(art: String) -> Dictionary:
	var sides := empty()
	if not PlayerProfile.is_valid_ball_art(art):
		return sides
	var raw := Marshalls.base64_to_raw(art)
	for cell in CELLS:
		sides[FRONT][cell] = 1 if _bit(raw, 0, cell) else 0
		sides[BACK][cell] = 1 if _bit(raw, BYTES_PER_SIDE, cell) else 0
	return sides

## The stored string for two sides (web encodeBallArt); "" when nothing is painted (web drops the field).
@warning_ignore("integer_division")
static func encode(sides: Dictionary) -> String:
	if is_empty(sides):
		return ""
	var raw := PackedByteArray()
	raw.resize(AppearanceConst.BALL_ART_BYTES)
	for side_index in 2:
		var grid: PackedByteArray = sides[FRONT if side_index == 0 else BACK]
		for cell in CELLS:
			if grid[cell] != 0:
				raw[side_index * BYTES_PER_SIDE + cell / BITS_PER_BYTE] |= 1 << (cell % BITS_PER_BYTE)
	return Marshalls.raw_to_base64(raw)

static func is_empty(sides: Dictionary) -> bool:
	return not ((sides[FRONT] as PackedByteArray).has(1) or (sides[BACK] as PackedByteArray).has(1))

## Whether the cell's centre lies inside the circle inscribed in the grid (web cellInDisc).
static func cell_in_disc(cx: int, cy: int) -> bool:
	var dx := (cx + HALF_CELL - DISC_RADIUS) / DISC_RADIUS
	var dy := (cy + HALF_CELL - DISC_RADIUS) / DISC_RADIUS
	return dx * dx + dy * dy <= 1.0

## Texture bytes (L8, TEX_W × TEX_H) for a stored artwork string; invalid or empty -> all white.
static func texture_bytes(art: String) -> PackedByteArray:
	var data := PackedByteArray()
	data.resize(TEX_W * TEX_H)
	data.fill(EMPTY)
	if not PlayerProfile.is_valid_ball_art(art):
		return data
	var raw := Marshalls.base64_to_raw(art)
	for cy in SIZE:
		var ty := SIZE - 1 - cy
		for cx in SIZE:
			var cell := cy * SIZE + cx
			if _bit(raw, 0, cell):
				data[ty * TEX_W + cx] = PAINTED
			if _bit(raw, BYTES_PER_SIDE, cell):
				data[ty * TEX_W + SIZE + cx] = PAINTED
	return data

static func texture(art: String) -> ImageTexture:
	return ImageTexture.create_from_image(Image.create_from_data(TEX_W, TEX_H, false, Image.FORMAT_L8, texture_bytes(art)))

@warning_ignore("integer_division")
static func _bit(raw: PackedByteArray, offset: int, cell: int) -> bool:
	return (raw[offset + cell / BITS_PER_BYTE] >> (cell % BITS_PER_BYTE)) & 1 == 1
