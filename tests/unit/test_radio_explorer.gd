extends GutTest
## RadioExplorer — web RadioExplorer against the window capture (the window [504, 131, 612, 372]; inside it the toolbar
## 43 px with buttons from (9, 39), the address field 594×24 at (9, 81), the cells from (17, 129) 112 px apart, the second
## row at 223.375, the status bar from y 345): the counts, the folder's title, back / up / home, selection, a track
## played with its folder as the queue.

const EPS := 0.01
const SCREEN := Vector2i(1280, 720)
const ROOT := "user://test_radio_explorer"
const DISPLAY_ROOT := "C:\\Users\\PARITY7\\AppData\\Roaming\\com.oneshot.game\\radio"
const SETTINGS := "user://test_radio_explorer.cfg"

func before_each() -> void:
	_remove_tree(ProjectSettings.globalize_path(ROOT))
	DirAccess.remove_absolute(ProjectSettings.globalize_path(SETTINGS))

func after_all() -> void:
	_remove_tree(ProjectSettings.globalize_path(ROOT))
	DirAccess.remove_absolute(ProjectSettings.globalize_path(SETTINGS))

## The web capture's seeded library.
func _explorer() -> RadioExplorer:
	var library := RadioLibrary.new(ROOT)
	RadioLibrarySeed.seed(library)
	var viewport := SubViewport.new()
	viewport.size = SCREEN
	add_child_autofree(viewport)
	var holder := Control.new()
	holder.size = Vector2(SCREEN)
	viewport.add_child(holder)
	var explorer := RadioExplorer.new()
	explorer.display_root = DISPLAY_ROOT
	explorer.settings_path = SETTINGS
	holder.add_child(explorer)
	explorer.open_on(library, Vector2(SCREEN))
	return explorer

func test_the_window_toolbar_address_and_status_follow_chrome() -> void:
	var explorer := _explorer()
	assert_eq(explorer.geometry(), Rect2(504.0, 131.0, 612.0, 372.0))
	assert_eq(explorer.title_lines()[0].label().text, I18n.t("radioLibrary").to_upper())
	var back: Control = explorer.tool_buttons()[0]
	assert_eq(back.position + explorer.content().position, Vector2(9.0, 39.0), "web ◀ at [513, 170]")
	assert_eq(back.size.y, 26.0)
	assert_almost_eq((explorer.tool_buttons()[2] as Control).size.x, 30.0, EPS, "⌂ keeps min-width 30")
	assert_almost_eq(back.modulate.a, RadioExplorer.DISABLED_OPACITY, EPS, "nowhere to go back")
	var field := explorer.find_child("Field", true, false) as Control
	assert_eq(Rect2(field.global_position - explorer.global_position, field.size), Rect2(9.0, 80.0, 594.0, 24.0))
	assert_eq(explorer.address_text(), DISPLAY_ROOT)
	assert_eq(explorer.status_text(), "6 %s · 2 %s" % [I18n.t("radioItems"), I18n.t("radioFolders")])
	assert_eq(explorer.viz_button().text, "⟳ AUTO")
	var status := explorer.find_child("Status", true, false) as Control
	assert_almost_eq(status.global_position.y - explorer.global_position.y, 345.0, EPS, "web status at 476")

func test_the_grid_puts_folders_first_in_104_px_cells() -> void:
	var explorer := _explorer()
	var names := explorer.items().map(func(item: RadioLibraryItem) -> String: return item.entry[RadioLibrary.NAME])
	assert_eq(names, ["Ambient", "Night Drive", "Ashen Drift", "Fathom XS·17", "Twin", "Twin (2)"])
	var first: RadioLibraryItem = explorer.items()[0]
	assert_eq(first.global_position - explorer.global_position, Vector2(17.0, 129.0), "web cell at [521, 260]")
	assert_almost_eq(first.size.y, 76.375, EPS, "8 + 36 + 8 + 14.375 + 8, two borders")
	assert_almost_eq(explorer.items()[4].position.x - first.position.x, 448.0, EPS, "five columns 112 apart")
	assert_almost_eq(explorer.items()[5].position.y - first.position.y, 94.375, EPS, "the next row 18 under")
	assert_almost_eq(explorer.items()[5].size.y, 74.375, EPS, "a row of cassettes only")
	await wait_process_frames(2)   # the names' boxes settle with the theme fonts
	for i in explorer.items().size():
		var item: RadioLibraryItem = explorer.items()[i]
		var icon_x := 29.0 if item.is_folder() else 26.0   # web folder [550, 269], cassette [771, 269]
		assert_eq(item.icon().position, Vector2(icon_x, 9.0), "icon %d" % i)
		var label := item.label()
		assert_almost_eq(label.position.x + label.css_offset_x, (RadioLibraryItem.WIDTH - label.size.x) * 0.5, EPS,
			"name %d centred" % i)
		assert_eq(label.position.y, 9.0 + item.icon().size.y + 8.0, "name %d 8 px under the icon (web y 313 / 311)" % i)

func test_selection_follows_click_ctrl_and_shift() -> void:
	var explorer := _explorer()
	explorer.select("Twin.json")
	assert_eq(explorer.selection(), ["Twin.json"])
	assert_true(explorer.items()[4].selected)
	explorer.select("Ambient", true)
	assert_eq(explorer.selection().size(), 2)
	assert_true(explorer.status_text().ends_with(" · 2 ✓"))
	explorer.select("Ashen Drift.json")
	explorer.select("Twin (2).json", false, true)
	assert_eq(explorer.selection().size(), 4, "Ashen Drift to Twin (2) in display order")

func test_folders_open_and_back_up_home_return() -> void:
	var explorer := _explorer()
	explorer.open_entry(explorer.entries()[1])
	assert_eq(explorer.current_path(), "Night Drive")
	assert_eq(explorer.title_lines()[0].label().text, "NIGHT DRIVE")
	assert_eq(explorer.address_text(), DISPLAY_ROOT + "\\Night Drive")
	assert_eq(explorer.status_text(), "1 %s · 0 %s" % [I18n.t("radioItems"), I18n.t("radioFolders")])
	assert_almost_eq((explorer.tool_buttons()[0] as Control).modulate.a, 1.0, EPS)
	explorer.go_up()
	assert_eq(explorer.current_path(), "", "web goUp leaves the history alone")
	explorer.go_back()
	assert_eq(explorer.current_path(), "", "back to the entry navInto pushed")
	assert_almost_eq((explorer.tool_buttons()[0] as Control).modulate.a, RadioExplorer.DISABLED_OPACITY, EPS)
	explorer.navigate_into("Night Drive")
	explorer.go_home()
	assert_eq(explorer.current_path(), "")
	explorer.go_back()
	assert_eq(explorer.current_path(), "Night Drive", "web goHome pushes the folder it left")

func test_a_track_plays_its_folder_from_itself() -> void:
	var explorer := _explorer()
	watch_signals(explorer)
	explorer.open_entry(explorer.entries()[4])
	var args: Array = get_signal_parameters(explorer, "play_requested")
	assert_eq(args[0].size(), 4, "the root's four tracks")
	assert_eq(args[1], 2, "Twin is the third")
	assert_eq(args[0][2]["name"], "Twin")

func test_the_visualizer_pill_cycles_and_remembers() -> void:
	var explorer := _explorer()
	explorer.cycle_viz()
	assert_eq(explorer.viz_mode(), "scope")
	assert_eq(explorer.viz_button().text, "◉ SCOPE")
	var again := _explorer()
	assert_eq(again.viz_mode(), "scope", "web localStorage radio.viz")

func _key(keycode: Key, ctrl := false) -> InputEventKey:
	var key := InputEventKey.new()
	key.keycode = keycode
	key.ctrl_pressed = ctrl
	key.pressed = true
	return key

func _names(explorer: RadioExplorer) -> Array:
	return explorer.entries().map(func(entry: Dictionary) -> String: return entry[RadioLibrary.NAME])

func test_a_menu_on_an_item_selects_it_and_offers_its_actions() -> void:
	var explorer := _explorer()
	explorer.open_menu(explorer.entries()[4], explorer.items()[4].global_position)
	assert_eq(explorer.selection(), ["Twin.json"], "web onContextMenu selects the item first")
	var menu := explorer.context_menu()
	assert_not_null(menu)
	assert_eq(menu.get_parent(), explorer.get_parent(), "over the window, beside it")
	assert_eq(menu.items().map(func(item: Dictionary) -> String: return item[RadioExplorerMenu.ACTION]),
		[RadioExplorerMenu.PLAY, RadioExplorerMenu.NEW_FOLDER, RadioExplorerMenu.RENAME, RadioExplorerMenu.COPY,
			RadioExplorerMenu.PASTE, RadioExplorerMenu.DELETE])
	explorer.open_menu({}, Vector2(860.0, 440.0))
	assert_true(explorer.selection().is_empty(), "the window's menu clears the selection")
	assert_eq(explorer.context_menu().items().size(), 2)
	explorer.visible = false
	assert_null(explorer.context_menu(), "hiding the window closes its menu")

func test_new_folder_copy_paste_and_delete_change_the_library() -> void:
	var explorer := _explorer()
	explorer.new_folder()
	assert_true(_names(explorer).has(I18n.t("radioCtxNewFolder")))
	explorer.select("Twin.json")
	explorer.select("Ambient", true)
	explorer.copy_selection()
	assert_eq(explorer.clipboard_paths(), ["Twin.json"], "folders are not copied")
	explorer.navigate_into("Night Drive")
	explorer.paste()
	assert_eq(_names(explorer), ["Lagoon", "Twin"])
	explorer.go_back()
	explorer.select("Ambient")
	explorer.select("Ashen Drift.json", true)
	explorer.delete_selection()
	assert_false(_names(explorer).has("Ambient"))
	assert_false(_names(explorer).has("Ashen Drift"))
	assert_true(explorer.selection().is_empty())

func test_shortcuts_answer_only_with_a_selection_and_no_name_in_edit() -> void:
	var explorer := _explorer()
	explorer._unhandled_key_input(_key(KEY_DELETE))
	assert_eq(explorer.entries().size(), 6, "Del with nothing selected")
	explorer.select("Twin (2).json")
	explorer._unhandled_key_input(_key(KEY_C, true))
	assert_eq(explorer.clipboard_paths(), ["Twin (2).json"])
	explorer._unhandled_key_input(_key(KEY_V, true))
	assert_true(_names(explorer).has("Twin (3)"), "a free name")
	explorer.select("Twin.json")
	explorer._unhandled_key_input(_key(KEY_F2))
	assert_eq(explorer.renaming(), "Twin.json")
	explorer._unhandled_key_input(_key(KEY_DELETE))
	assert_true(_names(explorer).has("Twin"), "Del while a name is edited")

func test_rename_commits_a_new_name_and_escape_leaves_it() -> void:
	var explorer := _explorer()
	explorer.begin_rename("Ashen Drift.json")
	var item: RadioLibraryItem = explorer.items()[2]
	var field := item.rename_field()
	assert_not_null(field)
	assert_eq(field.text, "Ashen Drift")
	assert_almost_eq(item.natural_height(), 75.0, EPS, "9 + 34 + 8, the 15 px field, 9")
	assert_eq(Rect2(field.position, field.size), Rect2(6.0, 51.0, 92.0, 15.0), "web .rexp-rename [975, 311, 92, 15]")
	field.text = "Ember"
	item.finish_rename(false)
	assert_eq(explorer.renaming(), "")
	assert_true(_names(explorer).has("Ashen Drift"), "Escape")
	explorer.begin_rename("Ashen Drift.json")
	explorer.items()[2].rename_field().text = "  Ember "
	explorer.items()[2].finish_rename(true)
	assert_true(_names(explorer).has("Ember"), "trimmed")
	assert_false(_names(explorer).has("Ashen Drift"))

func test_a_click_on_the_address_copies_the_path() -> void:
	var explorer := _explorer()
	var copied := []
	explorer.clipboard = func(text: String) -> void: copied.append(text)
	explorer.copy_address()
	assert_eq(copied, [DISPLAY_ROOT])
	assert_true(explorer.is_address_copied())
	assert_true(explorer.copied_mark().visible, "the ✓")
	var mark := explorer.copied_mark()
	assert_almost_eq(mark.position.x + mark.size.x, 612.0 - 2.0 - 14.0, 1.0, "right: 14px in the address row")

func test_the_rubber_band_selects_what_it_touches() -> void:
	var explorer := _explorer()
	explorer.select("Twin (2).json")
	var origin := explorer.global_position
	explorer.begin_marquee(origin + Vector2(356.0, 309.0), false)   # web (860, 440) in the window at (504, 131)
	assert_true(explorer.selection().is_empty(), "a press on the empty grid starts over")
	assert_not_null(explorer.marquee())
	explorer.marquee_to(origin + Vector2(196.0, 159.0))             # web (700, 290)
	var picked := explorer.selection()
	picked.sort()
	assert_eq(picked, ["Ashen Drift.json", "Fathom XS·17.json", "Night Drive"], "every cell the band touches")
	assert_eq(explorer.marquee().size, Vector2(160.0, 150.0))
	explorer.end_marquee()
	assert_null(explorer.marquee())
	explorer.select("Twin (2).json")
	explorer.begin_marquee(origin + Vector2(356.0, 309.0), true)
	explorer.marquee_to(origin + Vector2(350.0, 300.0))
	assert_eq(explorer.selection(), ["Twin (2).json"], "Ctrl keeps the selection under an empty band")
	explorer.end_marquee()

func test_dragged_tracks_move_into_a_folder_but_not_where_they_are() -> void:
	var explorer := _explorer()
	var twin: RadioLibraryItem = explorer.items()[4]
	explorer.select("Ambient")
	var data: Dictionary = explorer.drag_data(twin)
	assert_eq(explorer.selection(), ["Twin.json"], "an unselected track becomes the selection")
	assert_eq(data[RadioExplorer.DRAG_MOVE], ["Twin.json"])
	assert_null(explorer.drag_data(explorer.items()[0]), "folders do not drag")
	explorer.select("Ashen Drift.json", true)
	explorer.select("Night Drive", true)
	assert_eq(explorer.drag_data(twin)[RadioExplorer.DRAG_MOVE], ["Ashen Drift.json", "Twin.json"], "tracks only")
	explorer.move_into("", ["Twin.json"])
	assert_true(_names(explorer).has("Twin"), "already there")
	explorer.move_into("Night Drive", ["Ashen Drift.json", "Twin.json"])
	assert_eq(_names(explorer), ["Ambient", "Night Drive", "Fathom XS·17", "Twin (2)"])
	explorer.navigate_into("Night Drive")
	assert_eq(_names(explorer), ["Ashen Drift", "Lagoon", "Twin"])

func test_only_folders_take_a_drop_and_light_up() -> void:
	var explorer := _explorer()
	var folder: RadioLibraryItem = explorer.items()[1]
	var track: RadioLibraryItem = explorer.items()[2]
	var move := {RadioExplorer.DRAG_MOVE: ["Twin.json"]}
	assert_true(explorer._can_drop_into(folder, move))
	assert_true(folder.drop_target)
	assert_false(explorer._can_drop_into(track, move))
	assert_false(explorer._can_drop_into(folder, {"other": 1}))
	folder.notification(Control.NOTIFICATION_DRAG_END)
	assert_false(folder.drop_target, "the drag is over")

func test_a_drop_target_dashes_its_border_like_blink() -> void:
	assert_almost_eq(RadioLibraryItem.dash_gap(103.5, 3.0, 2.0), 2.025, EPS, "21 dashes, 20 gaps along 103.5 px")
	assert_almost_eq(RadioLibraryItem.dash_gap(96.0, 3.0, 2.0), 1.8947, 0.001, "20 dashes fit closer to 2 than 19")
	var explorer := _explorer()
	var folder: RadioLibraryItem = explorer.items()[1]
	var look := folder.get_node("Box").material as ShaderMaterial
	assert_eq(look.get_shader_parameter("dash_px"), 0.0, "solid until a drag hovers")
	folder.drop_target = true
	assert_eq(look.get_shader_parameter("dash_px"), 3.0)
	assert_eq(look.get_shader_parameter("border_color"), UiTokens.OK)

func test_a_track_from_the_player_asks_to_be_saved_where_it_lands() -> void:
	var explorer := _explorer()
	watch_signals(explorer)
	var payload := {"name": "Live"}
	var data := {RadioExplorer.DRAG_TRACK: payload}
	var folder: RadioLibraryItem = explorer.items()[1]
	assert_true(explorer._can_drop_into(folder, data), "a folder takes the player's track")
	explorer._drop_into(folder, data)
	assert_signal_emitted_with_parameters(explorer, "save_requested", ["Night Drive", payload])
	explorer.drop_into(explorer.current_path(), data)
	assert_eq(get_signal_parameters(explorer, "save_requested")[0], "", "the grid saves into the folder shown")
	assert_false(explorer._can_drop_into(explorer.items()[2], data), "a cassette takes no drop")

func test_play_on_a_folder_queues_its_tracks_from_the_first() -> void:
	var explorer := _explorer()
	watch_signals(explorer)
	explorer.play_entry(explorer.entries()[1])
	var args: Array = get_signal_parameters(explorer, "play_requested")
	assert_eq(args[0].size(), 1)
	assert_eq(args[0][0]["name"], "Lagoon")
	assert_eq(args[1], 0)

func _remove_tree(absolute: String) -> void:
	if not DirAccess.dir_exists_absolute(absolute):
		return
	for sub in DirAccess.get_directories_at(absolute):
		_remove_tree(absolute.path_join(sub))
	for file in DirAccess.get_files_at(absolute):
		DirAccess.remove_absolute(absolute.path_join(file))
	DirAccess.remove_absolute(absolute)
