extends GutTest
## UiButton parity with web ui/Button + theme.css .btn: the 220 x 44 box, the primary / secondary / ghost looks per
## state (the later CSS rule winning where hover and :active tie), the disabled fade, the RESUME cooldown fill under
## the text and the keyboard focus outline.

const EPS := 0.01
const SCREEN := Vector2i(1280, 720)
const BOX := Vector2(220.0, 44.0)
const HALF := 0.5

func _button(text: String, variant: String) -> UiButton:
	var viewport := SubViewport.new()
	viewport.size = SCREEN
	add_child_autofree(viewport)
	var button := UiButton.new(text, variant)
	viewport.add_child(button)
	return button

func _flat(button: UiButton, state: String) -> StyleBoxFlat:
	return button.get_theme_stylebox(state) as StyleBoxFlat

func _assert_look(button: UiButton, state: String, background: Color, border: Color, text: Color, text_key: String) -> void:
	var style := _flat(button, state)
	assert_eq(style.bg_color, background, "%s background" % state)
	assert_eq(style.border_color, border, "%s border" % state)
	assert_eq(button.get_theme_color(text_key), text, "%s text" % state)

func test_box_matches_the_web_button() -> void:
	var button := _button("EXIT", UiButton.PRIMARY)
	await wait_process_frames(1)
	assert_eq(button.size, BOX, "min-width 220; 12 px padding and a 1 px border around the 16 px line")
	var normal := _flat(button, "normal")
	assert_almost_eq(normal.content_margin_left, UiButton.PADDING_X + UiButton.BORDER_PX, EPS)
	assert_almost_eq(normal.content_margin_right, UiButton.PADDING_X + UiButton.BORDER_PX, EPS,
		"the run holds Chrome's trailing letter spacing, not the box")
	var chrome := CssTextRun.new("EXIT", UiButton.FONT_SIZE, UiButton.LETTER_SPACING_EM, true)
	assert_almost_eq(button.run().width(), chrome.width(), EPS, "the bold label at 0.18em × 16 px = 2.88 px a glyph")
	assert_almost_eq(button.text_origin().x, (BOX.x - chrome.width()) * HALF, EPS, "centred like the CSS inline box")
	assert_almost_eq(normal.content_margin_top, UiButton.PADDING_Y + UiButton.BORDER_PX, EPS)
	assert_eq(normal.border_width_top, UiButton.BORDER_PX)
	assert_eq(button.get_theme_font_size("font_size"), UiButton.FONT_SIZE)

func test_primary_looks() -> void:
	var button := _button("EXIT", UiButton.PRIMARY)
	_assert_look(button, "normal", UiTokens.ACCENT_FILL, UiTokens.ACCENT_FILL, UiTokens.INK, "font_color")
	_assert_look(button, "hover", UiTokens.ACCENT_BRIGHT, UiTokens.ACCENT_BRIGHT, UiTokens.INK, "font_hover_color")
	_assert_look(button, "pressed", UiTokens.ACCENT_BRIGHT, UiTokens.ACCENT_BRIGHT, UiTokens.INK, "font_pressed_color")
	assert_gt((button.get_theme_font("font") as FontVariation).variation_embolden, 0.0, "font-weight bold")

func test_secondary_looks() -> void:
	var button := _button("PLAY", UiButton.SECONDARY)
	_assert_look(button, "normal", Color.TRANSPARENT, UiTokens.LINE, UiTokens.ACCENT_DIM, "font_color")
	_assert_look(button, "hover", UiTokens.ACCENT_FILL, UiTokens.ACCENT_FILL, UiTokens.INK, "font_hover_color")
	_assert_look(button, "pressed", UiTokens.ACCENT_PRESS, UiTokens.ACCENT_FILL, UiTokens.INK, "font_pressed_color")
	assert_eq((button.get_theme_font("font") as FontVariation).variation_embolden, 0.0)

func test_ghost_looks() -> void:
	var button := _button("TO MENU", UiButton.GHOST)
	_assert_look(button, "normal", Color.TRANSPARENT, UiTokens.GHOST_LINE, UiTokens.MUTED, "font_color")
	_assert_look(button, "hover", Color.TRANSPARENT, UiTokens.GHOST_LINE_HOVER, UiTokens.TEXT, "font_hover_color")
	_assert_look(button, "pressed", Color.TRANSPARENT, UiTokens.GHOST_LINE_HOVER, UiTokens.TEXT, "font_pressed_color")

func test_go_looks() -> void:
	var button := _button("READY", UiButton.GO)
	_assert_look(button, "normal", UiButton.GO_FILL, UiButton.GO_FILL, UiTokens.INK, "font_color")
	_assert_look(button, "hover", UiButton.GO_HOVER, UiButton.GO_HOVER, UiTokens.INK, "font_hover_color")
	_assert_look(button, "disabled", UiTokens.ACCENT_FILL, UiTokens.ACCENT_FILL, UiTokens.INK, "font_disabled_color")
	assert_gt((button.get_theme_font("font") as FontVariation).variation_embolden, 0.0, "a primary button: bold")

func test_disabled_fades_the_whole_button() -> void:
	var button := _button("RESUME", UiButton.PRIMARY)
	button.set_enabled(false)
	assert_true(button.disabled)
	assert_almost_eq(button.modulate.a, UiButton.DISABLED_OPACITY, EPS)
	assert_almost_eq(button.opacity(), UiButton.DISABLED_OPACITY, EPS)
	button.set_enabled(true)
	assert_almost_eq(button.modulate.a, 1.0, EPS)
	button.disabled_opacity = HALF
	button.set_enabled(false)
	assert_almost_eq(button.modulate.a, HALF, EPS, "the pause menu's inline opacity")
	_assert_look(button, "disabled", UiTokens.ACCENT_FILL, UiTokens.ACCENT_FILL, UiTokens.INK, "font_disabled_color")

func test_a_grouped_button_fades_as_one_layer() -> void:
	var viewport := SubViewport.new()
	viewport.size = SCREEN
	add_child_autofree(viewport)
	var button := UiButton.new("RESUME", UiButton.PRIMARY)
	var group := button.grouped()
	viewport.add_child(group)
	button.set_enabled(false)
	assert_almost_eq(group.opacity(), UiButton.DISABLED_OPACITY, EPS, "CSS opacity composites the button first")
	assert_almost_eq(button.modulate.a, 1.0, EPS, "no per-draw fade on top")
	assert_almost_eq(button.opacity(), UiButton.DISABLED_OPACITY, EPS)
	await wait_process_frames(1)
	assert_eq(group.get_combined_minimum_size(), BOX, "the group takes the button's box")
	assert_eq(button.size, BOX)

func test_cooldown_fill_grows_inside_the_border() -> void:
	var button := _button("RESUME", UiButton.PRIMARY)
	button.set_cooldown_share(HALF)
	var style := button.get_theme_stylebox("disabled") as UiButton.CooldownStyle
	assert_not_null(style, "the fill is part of the disabled box, so the text draws over it")
	assert_eq(style.fill_rect(Rect2(Vector2.ZERO, BOX)), Rect2(1.0, 1.0, 109.0, 42.0), "web span: 50% of the padding box")
	assert_eq(style.fill_color, UiButton.COOLDOWN_FILL)

func test_focus_outline_sits_outside_the_border() -> void:
	var button := _button("EXIT", UiButton.PRIMARY)
	var focus := _flat(button, "focus")
	assert_false(focus.draw_center)
	assert_eq(focus.border_color, UiTokens.ACCENT)
	assert_eq(focus.border_width_left, UiButton.FOCUS_OUTLINE_PX)
	assert_almost_eq(focus.expand_margin_left, float(UiButton.FOCUS_OUTLINE_PX + UiButton.FOCUS_OFFSET_PX), EPS)
