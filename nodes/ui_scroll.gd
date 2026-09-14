class_name UiScroll
## The app's themed scrollbar — port of web theme.css `*::-webkit-scrollbar`: a thin 5 px strip without buttons, its
## thumb a dim line colour at 35% with a 3 px radius, brightening to accent-dim under the mouse.

const WIDTH_PX := 5.0
const RADIUS := 3
const THUMB := Color(47.0 / 255.0, 111.0 / 255.0, 158.0 / 255.0, 0.35)
const HALF := 0.5
const THUMB_STATES := ["grabber", "grabber_highlight", "grabber_pressed"]

static func style(bar: VScrollBar) -> void:
	var track := StyleBoxEmpty.new()
	track.content_margin_left = WIDTH_PX * HALF
	track.content_margin_right = WIDTH_PX * HALF
	bar.add_theme_stylebox_override("scroll", track)
	bar.add_theme_stylebox_override("scroll_focus", track)
	for state in THUMB_STATES:
		var thumb := StyleBoxFlat.new()
		thumb.bg_color = THUMB if state == THUMB_STATES[0] else UiTokens.ACCENT_DIM
		thumb.set_corner_radius_all(RADIUS)
		thumb.content_margin_left = WIDTH_PX * HALF
		thumb.content_margin_right = WIDTH_PX * HALF
		bar.add_theme_stylebox_override(state, thumb)
