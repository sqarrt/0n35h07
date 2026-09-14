class_name AboutScreen extends Control
## "About the game" — port of web screens/About: the ABOUT title, DEVELOPER with the developer's name and links, TRAILER
## with WATCH (`trailer_requested`), and BACK pinned to the panel's bottom.

signal back_requested
signal trailer_requested

const TITLE_TEXT := "ABOUT"                        # web en settingsSecAbout
const DEV_GROUP_TEXT := "DEVELOPER"                # aboutDevGroup
const TRAILER_GROUP_TEXT := "TRAILER"              # aboutTrailerGroup
const WATCH_TEXT := "WATCH"                        # aboutWatch
const BACK_TEXT := "BACK"                          # settingsBack
const DEV_NAME := "Shatalov Dmitriy"               # web DEV_NAME
## [label, href] (web DEV_LINKS).
const DEV_LINKS := [["YouTube — @watooh", "https://www.youtube.com/@watooh"],
	["Twitch — dimonplafon", "https://www.twitch.tv/dimonplafon"], ["sqarrt1337@gmail.com", "mailto:sqarrt1337@gmail.com"]]
const NAME_PX := 16.8                              # 1.05rem, spaced 0.08em, accent-dim
const NAME_SPACING_EM := 0.08
const NAME_MARGIN_BOTTOM := 16.0                   # 1rem
const LINK_GAP := 8.0                              # the links column: gap 0.5rem
const LINKS_MARGIN_BOTTOM := 28.8                  # 1.8rem

var _title: Label
var _dev_header: Label
var _name: Label
var _links: Array[UiLink] = []
var _trailer_header: Label
var _watch: UiButton
var _back: UiButton

func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	_title = _add(MenuText.title("Title", TITLE_TEXT))
	_dev_header = _add(MenuText.sub_header("DevHeader", DEV_GROUP_TEXT))
	_name = _add(MenuText.label("DevName", DEV_NAME, NAME_PX, NAME_SPACING_EM, UiTokens.ACCENT_DIM))
	for i in DEV_LINKS.size():
		var link := UiLink.new(DEV_LINKS[i][0], DEV_LINKS[i][1])
		link.name = "Link%d" % i
		link.opened.connect(_open)
		add_child(link)
		_links.append(link)
	_trailer_header = _add(MenuText.sub_header("TrailerHeader", TRAILER_GROUP_TEXT))
	_watch = UiButton.new(WATCH_TEXT, UiButton.PRIMARY)
	_watch.name = "Watch"
	_watch.pressed.connect(func() -> void: trailer_requested.emit())
	add_child(_watch)
	_back = UiButton.new(BACK_TEXT, UiButton.GHOST)
	_back.name = "Back"
	_back.pressed.connect(func() -> void: back_requested.emit())
	add_child(_back)
	resized.connect(_layout)
	_layout()

func links() -> Array[UiLink]:
	return _links

func _layout() -> void:
	var width := size.x
	var y := get_viewport_rect().size.y * MenuText.SCREEN_TOP_SHARE
	y = _place(_title, y, _title.get_combined_minimum_size().x) + MenuText.TITLE_MARGIN_BOTTOM
	y = _place(_dev_header, y, width) + MenuText.SUB_HEADER_MARGIN_BOTTOM
	y = _place(_name, y, _name.get_combined_minimum_size().x) + NAME_MARGIN_BOTTOM
	for i in _links.size():
		y = _place(_links[i], y, _links[i].get_combined_minimum_size().x) + (LINK_GAP if i < _links.size() - 1 else 0.0)
	y = _place(_trailer_header, y + LINKS_MARGIN_BOTTOM, width) + MenuText.SUB_HEADER_MARGIN_BOTTOM
	for button in [_watch, _back]:
		button.custom_minimum_size.x = width
	_place(_watch, y + UiButton.MARGIN_Y, width)
	_place(_back, size.y - UiButton.MARGIN_Y - UiButton.BUTTON_HEIGHT, width)

## A box at a fractional CSS top, painted from a whole pixel; returns its bottom.
func _place(control: Control, top: float, width: float) -> float:
	var height := control.get_combined_minimum_size().y
	control.position = Vector2(0.0, CssPixel.snap(top))
	control.size = Vector2(width, height)
	return top + height

func _add(label: Label) -> Label:
	add_child(label)
	return label

func _open(href: String) -> void:
	OS.shell_open(href)
