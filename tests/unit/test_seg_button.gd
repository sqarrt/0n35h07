extends GutTest
## SegButton parity with web theme.css `.seg` (lobby map / time pickers) and `.seat-diff .seg` (bot difficulty):
## the box around the 11 px (or 9 px) tracked label, the idle / on / hover looks.

const EPS := 0.01
const SCREEN := Vector2i(1280, 720)

func _seg(text: String, size_variant: String) -> SegButton:
	var viewport := SubViewport.new()
	viewport.size = SCREEN
	add_child_autofree(viewport)
	var seg := SegButton.new(text, size_variant)
	viewport.add_child(seg)
	return seg

func _flat(seg: SegButton, state: String) -> StyleBoxFlat:
	return seg.get_theme_stylebox(state) as StyleBoxFlat

func test_boxes_match_the_web_segments() -> void:
	var seg := _seg("3 MIN", SegButton.NORMAL)
	await wait_process_frames(1)
	assert_almost_eq(seg.size.y, 25.0, EPS, "11 px line (13) + 5 px padding + 1 px border, twice")
	var small := _seg("PASSIVE", SegButton.SMALL)
	await wait_process_frames(1)
	assert_almost_eq(small.size.y, 18.0, EPS, "9 px line (10) + 3 px padding + 1 px border, twice")
	var normal := _flat(seg, "normal")
	assert_almost_eq(normal.content_margin_left, SegButton.PADDING[SegButton.NORMAL].x + SegButton.BORDER_PX, EPS)
	assert_almost_eq(normal.content_margin_right, normal.content_margin_left, EPS, "the run keeps the trailing spacing")
	var chrome := CssTextRun.new("3 MIN", SegButton.FONT_SIZES[SegButton.NORMAL], SegButton.LETTER_SPACING_EM)
	assert_almost_eq(seg.size.x, chrome.width() + normal.get_minimum_size().x, EPS, "0.08em × 11 px = 0.88 px a glyph")

func test_idle_on_and_hover_looks() -> void:
	var seg := _seg("MULTI", SegButton.NORMAL)
	assert_eq(_flat(seg, "normal").border_color, SegButton.IDLE_BORDER)
	assert_eq(seg.get_theme_color("font_color"), UiTokens.MUTED)
	assert_eq(_flat(seg, "hover").border_color, UiTokens.GHOST_LINE_HOVER)
	assert_eq(seg.get_theme_color("font_hover_color"), SegButton.HOVER_TEXT)
	seg.set_on(true)
	assert_true(seg.is_on())
	assert_eq(_flat(seg, "normal").border_color, UiTokens.ACCENT, "seg--on")
	assert_eq(_flat(seg, "normal").bg_color, SegButton.ON_BACKGROUND)
	assert_eq(seg.get_theme_color("font_color"), UiTokens.ACCENT)
	seg.set_on(false)
	assert_eq(_flat(seg, "normal").border_color, SegButton.IDLE_BORDER)
