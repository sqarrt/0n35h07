extends GutTest
## Ball artwork codec — web ballArt.ts: bit i of byte b is cell b*8+i, front bytes then back bytes, base64 of 64 bytes;
## nothing painted stores nothing; only cells inside the inscribed circle count.

func test_round_trip_and_bit_order() -> void:
	var sides := BallArt.empty()
	sides[BallArt.FRONT][0] = 1          # byte 0 bit 0
	sides[BallArt.FRONT][9] = 1          # byte 1 bit 1
	sides[BallArt.BACK][255] = 1         # back byte 31 bit 7
	var art := BallArt.encode(sides)
	assert_eq(art.length(), AppearanceConst.BALL_ART_BASE64_LEN)
	var raw := Marshalls.base64_to_raw(art)
	assert_eq(raw[0], 1)
	assert_eq(raw[1], 2)
	assert_eq(raw[AppearanceConst.BALL_ART_BYTES - 1], 128)
	assert_eq(BallArt.decode(art), sides)

func test_empty_art_stores_nothing() -> void:
	assert_eq(BallArt.encode(BallArt.empty()), "", "web encodes an empty artwork as undefined")
	assert_true(BallArt.is_empty(BallArt.decode("not base64")), "an invalid string decodes to empty sides")

func test_cells_inside_the_inscribed_circle() -> void:
	assert_true(BallArt.cell_in_disc(7, 7), "the centre")
	assert_true(BallArt.cell_in_disc(0, 7), "the middle of the left edge")
	assert_false(BallArt.cell_in_disc(0, 0), "a corner")
	assert_false(BallArt.cell_in_disc(1, 1), "near the corner: radius (6.5, 6.5) / 8 > 1")
