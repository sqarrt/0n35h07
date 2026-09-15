class_name RadioCodePanel extends RadioWindow
## The PROGRAM window of the Radio screen — web RadioCodePanel: the current Strudel program (RadioCodeView) in a
## RadioWindow 18 px from the top left, min(440 px, 20% of the screen) wide, rounded, and the screen's height less
## 100 px (at least 240) tall, never resized below 220×160. A click on the code copies it and the title reads
## "Program (copied)" for 1.2 s; _ and ✕ minimize it (the Radio player's PROGRAM bar brings it back).

const TITLE_KEY := "radioProgram"
const COPIED_KEY := "radioCopied"
const COPIED_FORMAT := "%s (%s)"
const COPIED_S := 1.2
const ORIGIN := Vector2(18.0, 18.0)
const WIDTH_SHARE := 0.2
const MAX_WIDTH := 440.0
const HEIGHT_MARGIN := 100.0
const MIN_HEIGHT := 240.0
const MIN_SIZE := Vector2(220.0, 160.0)

var clipboard := func(text: String) -> void: DisplayServer.clipboard_set(text)

var _view: RadioCodeView
var _code := ""
var _copied := false

func _init() -> void:
	super()                                     # the window's chrome first: a subclass _init doesn't run it on its own
	name = "RadioCode"
	_view = RadioCodeView.new()
	content().add_child(_view)
	content().resized.connect(func() -> void: _view.size = content().size)
	_view.copy_requested.connect(copy)

## web useWindowChrome's first geometry for a screen of `screen` px (read once, when the Radio screen mounts).
static func initial_geometry(screen: Vector2) -> Rect2:
	return Rect2(ORIGIN, Vector2(roundf(minf(MAX_WIDTH, screen.x * WIDTH_SHARE)), maxf(MIN_HEIGHT, screen.y - HEIGHT_MARGIN)))

func open_on(screen: Vector2) -> void:
	setup(_title_text(), initial_geometry(screen), MIN_SIZE)

func show_code(code: String) -> void:
	_code = code
	_view.show_code(code)

func code_view() -> RadioCodeView:
	return _view

func is_copied() -> bool:
	return _copied

## web copy: the program to the clipboard, "(copied)" in the title and the box lit until the 1.2 s timeout.
func copy() -> void:
	clipboard.call(_code)
	_show_copied(true)
	if is_inside_tree():
		get_tree().create_timer(COPIED_S).timeout.connect(func() -> void: _show_copied(false))

func relabel() -> void:
	set_title(_title_text())

func _show_copied(copied: bool) -> void:
	_copied = copied
	_view.set_copied(copied)
	set_title(_title_text())

func _title_text() -> String:
	return COPIED_FORMAT % [I18n.t(TITLE_KEY), I18n.t(COPIED_KEY)] if _copied else I18n.t(TITLE_KEY)
