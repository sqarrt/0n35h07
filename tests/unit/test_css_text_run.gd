extends GutTest
## CssTextRun — one line of the UI font laid out like Chrome's letter-spacing (web CSS, probe
## parity-probe-glyph-positions.mjs): every glyph advances by its own width plus the fractional spacing, the spacing
## follows the last glyph too, synthetic bold widens nothing, and the line box is `line-height: normal` with the ascent
## and descent each rounded.

const EPS := 0.01
const HALF := 0.5
const TOAST_PX := 12.5                 # web .invite-title: 12.5 px spaced 0.04em
const TOAST_SPACING_EM := 0.04
const BUTTON_PX := 16.0                # web .btn: 1rem spaced 0.18em
const BUTTON_SPACING_EM := 0.18
const INPUT_PX := 20.8                 # a 1.3rem field: an 18 + 5 px line
const LEGEND_PX := 11.52               # web ControlsLegend: 0.72rem monospace
const SYSTEM_FAMILY := "Consolas"
const SKEW := 0.25
const RUN := "0000000000"
const WORD := "APPEARANCE"

func test_the_width_is_chromes() -> void:
	for case in [[RUN, TOAST_PX, TOAST_SPACING_EM], [WORD, BUTTON_PX, BUTTON_SPACING_EM]]:
		var run := CssTextRun.new(case[0], case[1], case[2])
		assert_almost_eq(run.width(), UiFont.css_width(case[0], case[1], case[2]), EPS,
			"%s at %s px spaced %sem" % case)

func test_the_pen_moves_by_fractional_steps() -> void:
	var run := CssTextRun.new(RUN, TOAST_PX, TOAST_SPACING_EM)
	var pens := run.glyph_positions()
	var step := UiFont.css_width("0", TOAST_PX, TOAST_SPACING_EM)
	assert_eq(pens.size(), RUN.length())
	for i in pens.size():
		assert_almost_eq(pens[i], step * i, EPS, "glyph %d at %s × %d, not rounded" % [i, step, i])

func test_synthetic_bold_keeps_the_width() -> void:
	assert_almost_eq(CssTextRun.new(WORD, BUTTON_PX, BUTTON_SPACING_EM, true).width(),
		CssTextRun.new(WORD, BUTTON_PX, BUTTON_SPACING_EM).width(), EPS, "Chrome's fake bold widens no advance")

func test_synthetic_bold_grows_evenly_like_chromes() -> void:
	var embolden := UiFont.fake_bold_embolden(int(BUTTON_PX))
	assert_almost_eq(CssTextRun.new(WORD, BUTTON_PX, BUTTON_SPACING_EM, true).bold_ink_shift(),
		-UiFont.embolden_growth(embolden, int(BUTTON_PX)) * HALF, EPS, "Godot grows the bitmap right: half of it goes left")
	assert_eq(CssTextRun.new(WORD, BUTTON_PX, BUTTON_SPACING_EM).bold_ink_shift(), 0.0)

func test_a_font_variation_face_keeps_its_slant() -> void:
	var oblique := FontVariation.new()
	oblique.base_font = UiFont.base()
	oblique.variation_transform = Transform2D(Vector2(1.0, SKEW), Vector2(0.0, 1.0), Vector2.ZERO)
	var run := CssTextRun.new(WORD, BUTTON_PX, BUTTON_SPACING_EM, false, oblique)
	assert_eq(run.font().variation_transform, oblique.variation_transform, "the spin's synthetic oblique")
	assert_eq(run.font().spacing_glyph, 0, "the run spaces the glyphs itself")
	assert_almost_eq(run.width(), CssTextRun.new(WORD, BUTTON_PX, BUTTON_SPACING_EM).width(), EPS)

func test_a_system_face_brings_its_line_box() -> void:
	var face := SystemFont.new()
	face.font_names = PackedStringArray([SYSTEM_FAMILY])
	var run := CssTextRun.new(WORD, LEGEND_PX, 0.0, false, face)
	var ascent := roundi(face.get_ascent(UiFont.MEASURE_PX) * LEGEND_PX / UiFont.MEASURE_PX)
	assert_eq(run.baseline(), ascent, "Chrome sizes the line by the face that draws it")
	assert_eq(run.line_height(), ascent + roundi(face.get_descent(UiFont.MEASURE_PX) * LEGEND_PX / UiFont.MEASURE_PX))

func test_the_line_box_is_line_height_normal() -> void:
	assert_eq(CssTextRun.new(WORD, BUTTON_PX).line_height(), 18, "16 px: 14 + 4")
	assert_eq(CssTextRun.new(WORD, BUTTON_PX).baseline(), 14)
	assert_eq(CssTextRun.new(WORD, INPUT_PX).line_height(), 23, "20.8 px: 18 + 5")

func test_an_empty_run_is_empty() -> void:
	var run := CssTextRun.new("", BUTTON_PX, BUTTON_SPACING_EM)
	assert_eq(run.width(), 0.0)
	assert_eq(run.glyph_positions().size(), 0)
