extends GutTest
## Menu screen text boxes — web Settings / About inline styles measured in Chrome: the h2 27 px high, a field label
## 13 px, a sub-header 24 px (15 px line, 8 px padding, 1 px rule); fractional rem sizes keep the CSS spacing and line.

func _box(label: Label) -> Vector2:
	add_child_autofree(label)
	return label.get_combined_minimum_size()

func test_title_field_label_and_sub_header_heights() -> void:
	assert_eq(_box(MenuText.title("Title", "SETTINGS")).y, 27.0, "h2 24 px bold: line-height normal")
	assert_eq(_box(MenuText.field_label("Name", "NAME")).y, 13.0, "0.7rem label")
	assert_eq(_box(MenuText.sub_header("Volume", "VOLUME")).y, 24.0, "0.85rem line, 0.5rem padding, 1 px rule")

func test_fractional_sizes_keep_the_css_spacing_and_line() -> void:
	var header := MenuText.sub_header("Volume", "VOLUME")
	var font := header.get_theme_font("font") as FontVariation
	assert_eq(font.spacing_glyph, 2, "0.18em × 13.6 px = 2.45 → 2 (14 px would round to 3)")
	var input := MenuText.label("Input", "PARITY7", 20.8, 0.1, UiTokens.TEXT)
	assert_eq(_box(input).y, 23.0, "20.8 px: 18 + 5 (21 px would make 24)")

func test_sub_header_rule_sits_under_the_padding() -> void:
	var rule := MenuText.sub_header("Overlay", "OVERLAY").get_theme_stylebox("normal") as StyleBoxFlat
	assert_eq(rule.border_width_bottom, MenuText.SUB_HEADER_BORDER_PX)
	assert_eq(rule.border_color, UiTokens.SURFACE_LINE)
	assert_false(rule.draw_center)
