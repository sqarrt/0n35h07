extends GutTest
## UiFont parity with Chrome's text boxes: the `line-height: normal` height and baseline (rounded ascent and descent)
## and the synthetic bold strength.

const EPS := 0.001
const BUTTON_SIZE := 16          # web .btn 1rem: an 18 px line (44 - 24 padding - 2 border)
const TITLE_SIZE := 24           # web pause h2 1.5em: a 27 px box

func test_css_line_box_matches_chrome() -> void:
	for case in [[BUTTON_SIZE, 14.0, 18.0], [TITLE_SIZE, 21.0, 27.0]]:
		var font := UiFont.with_css_line(UiFont.spaced(0.0, case[0]), case[0])
		assert_almost_eq(font.get_ascent(case[0]), case[1], EPS, "%d px baseline" % case[0])
		assert_almost_eq(font.get_height(case[0]), case[2], EPS, "%d px line box" % case[0])

func test_synthetic_bold_follows_the_skia_ratio() -> void:
	assert_almost_eq(UiFont.fake_bold_embolden(9), UiFont.EMBOLDEN_UNIT_SIZE / 24.0, EPS)
	assert_almost_eq(UiFont.fake_bold_embolden(36), UiFont.EMBOLDEN_UNIT_SIZE / 32.0, EPS)
	assert_gt(UiFont.fake_bold_embolden(BUTTON_SIZE), UiFont.fake_bold_embolden(TITLE_SIZE), "the ratio thins as text grows")
