extends GutTest
## RadioExplorerMenu — web RadioExplorer menu(c): the web capture's menu on a selected track with nothing copied is
## ▶ Play, ＋ New folder, ✎ Rename F2, ⧉ Copy Ctrl+C, 📋 Paste Ctrl+V (disabled), 🗑 Delete Del (danger).

func _actions(items: Array[Dictionary]) -> Array:
	return items.map(func(item: Dictionary) -> String: return item[RadioExplorerMenu.ACTION])

func test_a_selected_track_with_nothing_copied_is_the_web_capture() -> void:
	var items := RadioExplorerMenu.items(true, 1, 1, 0)
	assert_eq(_actions(items), [RadioExplorerMenu.PLAY, RadioExplorerMenu.NEW_FOLDER, RadioExplorerMenu.RENAME,
		RadioExplorerMenu.COPY, RadioExplorerMenu.PASTE, RadioExplorerMenu.DELETE])
	assert_eq(items.map(func(item: Dictionary) -> String: return item[RadioExplorerMenu.GLYPH]), ["▶", "＋", "✎", "⧉", "📋", "🗑"])
	assert_eq(items[2][RadioExplorerMenu.ACCEL], "F2")
	assert_true(items[4][RadioExplorerMenu.DISABLED], "nothing copied")
	assert_true(items[5][RadioExplorerMenu.DANGER])
	assert_eq(items[3][RadioExplorerMenu.FAMILIES], ["Cambria Math"], "Chrome's face for ⧉")

func test_the_window_menu_offers_a_folder_and_paste() -> void:
	var items := RadioExplorerMenu.items(false, 0, 0, 2)
	assert_eq(_actions(items), [RadioExplorerMenu.NEW_FOLDER, RadioExplorerMenu.PASTE])
	assert_false(items[1][RadioExplorerMenu.DISABLED], "two tracks copied")

func test_a_multi_selection_or_a_folder_drops_rename_or_copy() -> void:
	assert_eq(_actions(RadioExplorerMenu.items(true, 3, 2, 0)), [RadioExplorerMenu.PLAY, RadioExplorerMenu.NEW_FOLDER,
		RadioExplorerMenu.COPY, RadioExplorerMenu.PASTE, RadioExplorerMenu.DELETE])
	assert_eq(_actions(RadioExplorerMenu.items(true, 1, 0, 0)), [RadioExplorerMenu.PLAY, RadioExplorerMenu.NEW_FOLDER,
		RadioExplorerMenu.RENAME, RadioExplorerMenu.PASTE, RadioExplorerMenu.DELETE], "a folder: nothing to copy")
