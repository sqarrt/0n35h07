extends GutTest
## RadioCodePanel — web RadioCodePanel: the first geometry (the window capture [18, 18, 256, 620], fullscreen 440 px wide
## and 1340 tall in 2560×1440 CSS px), the code box filling the window under its bar, a click copying the program with
## "(copied)" in the title.

const SCREEN := Vector2i(1280, 720)
const FULLSCREEN_CSS := Vector2(2560.0, 1440.0)

var _clipboard := []

func _panel() -> RadioCodePanel:
	_clipboard = []
	var viewport := SubViewport.new()
	viewport.size = SCREEN
	add_child_autofree(viewport)
	var holder := Control.new()
	holder.size = Vector2(SCREEN)
	viewport.add_child(holder)
	var panel := RadioCodePanel.new()
	panel.clipboard = func(text: String) -> void: _clipboard.append(text)
	holder.add_child(panel)
	panel.open_on(Vector2(SCREEN))
	return panel

func test_the_first_geometry_follows_the_screen() -> void:
	assert_eq(RadioCodePanel.initial_geometry(Vector2(SCREEN)), Rect2(18.0, 18.0, 256.0, 620.0))
	assert_eq(RadioCodePanel.initial_geometry(FULLSCREEN_CSS), Rect2(18.0, 18.0, 440.0, 1340.0))
	assert_eq(RadioCodePanel.initial_geometry(Vector2(800.0, 300.0)).size, Vector2(160.0, 240.0), "at least 240 tall")

func test_the_code_fills_the_window_under_the_bar() -> void:
	var panel := _panel()
	panel.show_code("setcpm(122/4)")
	assert_eq(panel.code_view().size, Vector2(254.0, 588.0), "web radio-code-copy [19, 49, 254, 588]")
	assert_eq(panel.title_lines()[0].label().text, I18n.t("radioProgram").to_upper())

func test_a_click_copies_the_program_and_says_so() -> void:
	var panel := _panel()
	panel.show_code("setcpm(122/4)")
	panel.code_view().copy_requested.emit()
	assert_eq(_clipboard, ["setcpm(122/4)"])
	assert_true(panel.is_copied())
	var shown := panel.title_lines().filter(func(line: GlowText) -> bool: return line.visible)
	assert_eq(" ".join(shown.map(func(line: GlowText) -> String: return line.label().text)),
		("%s (%s)" % [I18n.t("radioProgram"), I18n.t("radioCopied")]).to_upper())
