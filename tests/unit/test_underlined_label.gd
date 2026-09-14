extends GutTest
## UnderlinedLabel — CSS `text-decoration: underline` under a CssLabel: a 1 px line `offset_px` below the run's baseline.

const EPS := 0.01
const SCREEN := Vector2i(640, 360)
const NICK_PX := 16.0                  # web .lobby-nick: 16 px spaced 0.06em, text-underline-offset 5px
const NICK_SPACING_EM := 0.06
const OFFSET := 5.0

func test_the_line_sits_under_the_runs_baseline() -> void:
	var viewport := SubViewport.new()
	viewport.size = SCREEN
	add_child_autofree(viewport)
	var nick := UnderlinedLabel.new()
	nick.styled("PARITY7", NICK_PX, NICK_SPACING_EM, Color.WHITE)
	nick.underline = true
	nick.offset_px = OFFSET
	viewport.add_child(nick)
	await wait_process_frames(1)
	var run := CssTextRun.new("PARITY7", NICK_PX, NICK_SPACING_EM)
	assert_almost_eq(nick.underline_y(), run.baseline() + OFFSET + UnderlinedLabel.THICKNESS_PX * UnderlinedLabel.HALF, EPS)
	assert_almost_eq(nick.get_combined_minimum_size().x, run.width(), EPS, "the underline spans Chrome's inline box")
