class_name BallArt
## Ball artwork texture — port of web ballArt.ts (two 16×16 one-bit sides, bit i of byte b = cell b*8+i) and
## artTexture.ts writeArtData: a 32×16 luminance layout, front|back, painted cells 0 (black multiplier), empty 255,
## rows flipped so the editor's top row is the ball's top.

const SIZE := 16
const TEX_W := SIZE * 2
const TEX_H := SIZE
const BITS_PER_BYTE := 8
const BYTES_PER_SIDE := AppearanceConst.BALL_ART_BYTES >> 1   # front and back halves
const PAINTED := 0
const EMPTY := 255

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
