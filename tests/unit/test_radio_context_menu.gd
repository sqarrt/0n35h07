extends GutTest
## RadioContextMenu — web .rexp-ctx against the capture (a right click at (1021, 298) on a 1280 px screen: the menu
## [1021, 298, 208, …], rows 194 px wide from (7, 7), 32 px tall where a 16 px glyph line sets them): placement, width,
## row geometry, labels, looks and choosing.

const EPS := 0.01
const SCREEN := Vector2(1280.0, 720.0)
const CLICK := Vector2(1021.0, 298.0)

func _menu(items: Array[Dictionary], at := CLICK) -> RadioContextMenu:
	var holder := Control.new()
	holder.size = SCREEN
	add_child_autofree(holder)
	var menu := RadioContextMenu.new()
	holder.add_child(menu)
	menu.open(items, at, SCREEN.x)
	return menu

func test_the_capture_menu_sits_at_the_click_208_wide() -> void:
	var menu := _menu(RadioExplorerMenu.items(true, 1, 1, 0))
	assert_eq(menu.position, CLICK)
	assert_almost_eq(menu.size.x, 208.0, EPS, "min-width 208, border-box")
	assert_eq(menu.rows().size(), 6)
	var first := menu.rows()[0]
	assert_eq(first.position, Vector2(7.0, 7.0), "1 px border and 6 px padding")
	assert_almost_eq(first.size.x, 194.0, EPS)
	var bottom := menu.rows()[5].position.y + menu.rows()[5].size.y
	assert_almost_eq(menu.size.y, bottom + 7.0, EPS)
	for i in menu.rows().size():
		if i > 0:
			assert_almost_eq(menu.rows()[i].position.y, menu.rows()[i - 1].position.y + menu.rows()[i - 1].size.y, EPS)
		assert_gte(menu.rows()[i].size.y, 16.0 + 14.0, "8 px padding around at least the UI font's line")

func test_labels_glyphs_and_shortcuts_follow_the_rows() -> void:
	var menu := _menu(RadioExplorerMenu.items(true, 1, 1, 0))
	var rename := menu.row_of(RadioExplorerMenu.RENAME)
	assert_eq((rename.get_node("Key") as CssLabel).text, "✎")
	var label := rename.get_node("Label") as CssLabel
	assert_eq(label.text, I18n.t("radioCtxRename"))
	assert_almost_eq(label.position.x, 38.0, EPS, "12 px padding, the 15 px glyph box, an 11 px gap")
	var accel := rename.get_node("Accel") as CssLabel
	assert_true(accel.visible)
	assert_eq(accel.text, "F2")
	assert_almost_eq(accel.position.x + accel.size.x, 194.0 - 12.0, EPS, "margin-left: auto")
	assert_false((menu.row_of(RadioExplorerMenu.PLAY).get_node("Accel") as CanvasItem).visible)
	assert_eq((menu.row_of(RadioExplorerMenu.DELETE).get_node("Label") as CssLabel).get_theme_color("font_color"),
		RadioContextMenu.DANGER_TEXT)
	assert_eq((menu.row_of(RadioExplorerMenu.PASTE).get_node("Label") as CssLabel).get_theme_color("font_color"),
		UiTokens.MUTED, "nothing to paste")

func test_the_right_edge_keeps_220_px() -> void:
	var menu := _menu(RadioExplorerMenu.items(false, 0, 0, 0), Vector2(1200.0, 100.0))
	assert_eq(menu.position, Vector2(SCREEN.x - 220.0, 100.0))

func test_choosing_an_enabled_row_closes_and_a_disabled_one_does_nothing() -> void:
	var menu := _menu(RadioExplorerMenu.items(true, 1, 1, 0))
	watch_signals(menu)
	menu.choose(4)   # Paste with nothing copied
	assert_signal_not_emitted(menu, "chosen")
	menu.choose(1)
	assert_signal_emitted_with_parameters(menu, "chosen", [RadioExplorerMenu.NEW_FOLDER])
	assert_signal_emitted(menu, "closed")
	assert_true(menu.is_queued_for_deletion())
