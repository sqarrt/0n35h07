class_name UiScroll
## The app's scrollbar as the desktop WebView draws it. web theme.css sets `scrollbar-width: thin` and `scrollbar-color`
## on every element, so Chrome ignores the `::-webkit-scrollbar` rules and draws its native thin bar: a 10 px gutter
## (web .lobby-body offsetWidth 626 − clientWidth 616) with 12 px arrow buttons and a 6 px round-ended thumb, all in the
## thumb colour — measured on the web lobby frame.

const WIDTH_PX := 10.0
const THUMB_PX := 6.0
const RADIUS := 3
const THUMB := Color(47.0 / 255.0, 111.0 / 255.0, 158.0 / 255.0, 0.35)
const HALF := 0.5
const THUMB_STATES := ["grabber", "grabber_highlight", "grabber_pressed"]   # no :hover rule survives scrollbar-color
const UP_ICONS := ["decrement", "decrement_highlight", "decrement_pressed"]
const DOWN_ICONS := ["increment", "increment_highlight", "increment_pressed"]
const ARROW_SIZE := Vector2i(10, 12)
## The up arrow in its button (px, y down), fitted to Chrome's pixel coverage: a 6 px base whose sides climb 0.7 px a row
## to a blunt tip.
const ARROW_OUTLINE := [Vector2(4.37, 2.8), Vector2(5.63, 2.8), Vector2(8.0, 6.17), Vector2(8.0, 7.27),
	Vector2(2.0, 7.27), Vector2(2.0, 6.17)]
const ARROW_SUBSAMPLES := 8

static var _arrows := {}                       # down? -> the arrow icon

static func style(bar: VScrollBar) -> void:
	var track := StyleBoxEmpty.new()
	track.content_margin_left = WIDTH_PX * HALF
	track.content_margin_right = WIDTH_PX * HALF
	bar.add_theme_stylebox_override("scroll", track)
	bar.add_theme_stylebox_override("scroll_focus", track)
	var thumb := StyleBoxFlat.new()
	thumb.bg_color = THUMB
	thumb.set_corner_radius_all(RADIUS)
	thumb.content_margin_left = WIDTH_PX * HALF
	thumb.content_margin_right = WIDTH_PX * HALF
	thumb.expand_margin_left = (THUMB_PX - WIDTH_PX) * HALF   # the thumb sits 2 px inside each edge of the gutter
	thumb.expand_margin_right = (THUMB_PX - WIDTH_PX) * HALF
	for state in THUMB_STATES:
		bar.add_theme_stylebox_override(state, thumb)
	for key in UP_ICONS:
		bar.add_theme_icon_override(key, arrow(false))
	for key in DOWN_ICONS:
		bar.add_theme_icon_override(key, arrow(true))

## An arrow button's icon (cached): each pixel's coverage by the outline in the thumb colour, mirrored for the down arrow.
static func arrow(down: bool) -> ImageTexture:
	if not _arrows.has(down):
		var outline := PackedVector2Array()
		for point: Vector2 in ARROW_OUTLINE:
			outline.append(Vector2(point.x, ARROW_SIZE.y - point.y) if down else point)
		var image := Image.create(ARROW_SIZE.x, ARROW_SIZE.y, false, Image.FORMAT_RGBA8)
		for y in ARROW_SIZE.y:
			for x in ARROW_SIZE.x:
				image.set_pixel(x, y, Color(THUMB, THUMB.a * _coverage(outline, x, y)))
		_arrows[down] = ImageTexture.create_from_image(image)
	return _arrows[down]

static func _coverage(outline: PackedVector2Array, x: int, y: int) -> float:
	var inside := 0
	for sub_y in ARROW_SUBSAMPLES:
		for sub_x in ARROW_SUBSAMPLES:
			var sample := Vector2(x + (sub_x + HALF) / ARROW_SUBSAMPLES, y + (sub_y + HALF) / ARROW_SUBSAMPLES)
			if Geometry2D.is_point_in_polygon(sample, outline):
				inside += 1
	return float(inside) / (ARROW_SUBSAMPLES * ARROW_SUBSAMPLES)
