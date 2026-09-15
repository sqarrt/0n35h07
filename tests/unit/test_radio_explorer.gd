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

func _remove_tree(absolute: String) -> void:
	if not DirAccess.dir_exists_absolute(absolute):
		return
	for sub in DirAccess.get_directories_at(absolute):
		_remove_tree(absolute.path_join(sub))
	for file in DirAccess.get_files_at(absolute):
		DirAccess.remove_absolute(absolute.path_join(file))
	DirAccess.remove_absolute(absolute)
