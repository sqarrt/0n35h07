extends GutTest
## UiFont parity with Chrome's text boxes: the `line-height: normal` height and baseline (rounded ascent and descent)
## and the synthetic bold strength.

const EPS := 0.001
const BUTTON_SIZE := 16          # web .btn 1rem: an 18 px line (44 - 24 padding - 2 border)
const TITLE_SIZE := 24           # web pause h2 1.5em: a 27 px box
const BUTTON_LINE_PX := 18
const TALL_SPACING_PX := 1000    # a face far taller than the UI font
const SYMBOL_FAMILIES := ["Consolas"]
const BIG_SIZE := 128            # web .trailer-title 8rem: a whole-pixel embolden advance (0.5 × 128 / 64)
const BIG_SPACING_EM := 0.18
const SAMPLE := "0N35H07"
const TOAST_TITLE_PX := 12.5     # web .invite-title: 12.5 px spaced 0.04em, Chrome's advance 7.25 px
const TOAST_TITLE_SPACING_EM := 0.04
const RUN_GLYPHS := 27           # "alice invites you to a game"
const HALF_PIXEL := 0.5

func test_css_line_box_matches_chrome() -> void:
	for case in [[BUTTON_SIZE, 14.0, 18.0], [TITLE_SIZE, 21.0, 27.0]]:
		var font := UiFont.with_css_line(UiFont.spaced(0.0, case[0]), case[0])
		assert_almost_eq(font.get_ascent(case[0]), case[1], EPS, "%d px baseline" % case[0])
		assert_almost_eq(font.get_height(case[0]), case[2], EPS, "%d px line box" % case[0])

func test_a_line_with_a_taller_face_takes_its_ascent() -> void:
	assert_eq(UiFont.mixed_line_px(BUTTON_SIZE, UiFont.base()), BUTTON_LINE_PX, "a face no taller keeps the line box")
	var tall := FontVariation.new()
	tall.base_font = UiFont.base()
	tall.spacing_top = TALL_SPACING_PX
	var ascent := roundi((UiFont.ASCENT_EM * UiFont.MEASURE_PX + TALL_SPACING_PX) * BUTTON_SIZE / UiFont.MEASURE_PX)
	assert_eq(UiFont.mixed_line_px(BUTTON_SIZE, tall), ascent + roundi(UiFont.DESCENT_EM * BUTTON_SIZE))

func test_faces_with_system_fallbacks_are_shared() -> void:
	assert_same(UiFont.base_with(SYMBOL_FAMILIES), UiFont.base_with(SYMBOL_FAMILIES))
	assert_same(UiFont.base_cjk(), UiFont.base_with(UiFont.CJK_FAMILIES))
	assert_eq(UiFont.base_with(SYMBOL_FAMILIES).fallbacks.size(), UiFont.CJK_FALLBACK_COUNT, "Cyrillic, then the system face")

func test_synthetic_bold_keeps_the_advances() -> void:
	var plain := UiFont.spaced(BIG_SPACING_EM, BIG_SIZE)
	var bold := UiFont.bold_spaced(BIG_SPACING_EM, BIG_SIZE)
	# the CSS box: glyphs, the gaps and the trailing spacing (trailing_spacing_style) — web .trailer-title is 645.1 px
	assert_eq(bold.get_string_size(SAMPLE, HORIZONTAL_ALIGNMENT_LEFT, -1, BIG_SIZE).x + bold.spacing_glyph,
		plain.get_string_size(SAMPLE, HORIZONTAL_ALIGNMENT_LEFT, -1, BIG_SIZE).x + plain.spacing_glyph,
		"Chrome's synthetic bold widens no glyph: Godot's embolden advance comes out of the spacing")

func test_synthetic_bold_follows_the_skia_ratio() -> void:
	assert_almost_eq(UiFont.fake_bold_embolden(9), UiFont.EMBOLDEN_UNIT_SIZE / 24.0, EPS)
	assert_almost_eq(UiFont.fake_bold_embolden(36), UiFont.EMBOLDEN_UNIT_SIZE / 32.0, EPS)
	assert_gt(UiFont.fake_bold_embolden(BUTTON_SIZE), UiFont.fake_bold_embolden(TITLE_SIZE), "the ratio thins as text grows")

func test_fitted_spacing_keeps_a_run_as_wide_as_chromes() -> void:
	var size := UiFont.css_size(TOAST_TITLE_PX)
	var face := UiFont.spaced(0.0, size)
	face.spacing_glyph = roundi(UiFont.fitted_spacing(TOAST_TITLE_PX, TOAST_TITLE_SPACING_EM, size))
	var run := UiFont.FITTING_GLYPH.repeat(RUN_GLYPHS)
	var godot := face.get_string_size(run, HORIZONTAL_ALIGNMENT_LEFT, -1, size).x
	var chrome := UiFont.css_width(run, TOAST_TITLE_PX, TOAST_TITLE_SPACING_EM)
	assert_almost_eq(godot / RUN_GLYPHS, chrome / RUN_GLYPHS, HALF_PIXEL, "within half a pixel a glyph")
