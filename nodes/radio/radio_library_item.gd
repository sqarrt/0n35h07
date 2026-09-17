class_name RadioLibraryItem extends Control
## One cell of the Radio library grid — web RadioExplorer `.rexp-it`: 104 px wide, 8px 4px of padding inside a 1 px
## transparent border (radius 4), the icon centred on top and 8 px under it the name (11.5 px at line-height 1.25,
## centred, --text with a 0 1px 4px black text-shadow, wrapped inside 96 px as `word-break: break-word` wraps it —
## at spaces, and inside a word that would not fit a line of its own — so a long name grows the cell instead of
## running over its neighbour). The mouse over it: a ghost-line-hover border on
## accent 5%; selected: an accent border on accent 12% with a 16 px accent-16% inset glow.

signal pressed(item: RadioLibraryItem, event: InputEventMouseButton)
signal opened(item: RadioLibraryItem)
signal rename_finished(item: RadioLibraryItem, new_name: String, committed: bool)

const RENAME_WIDTH := 92.0                      # web .rexp-rename: 92 px, 11 px text centred, #070a0f in an accent border
const RENAME_PX := 11.0
const RENAME_FILL := Color("#070a0f")
const RENAME_RADIUS := 3
const RENAME_PADDING := Vector2.ZERO            # the theme's reset takes the <input> padding away (capture: 92×15)
const RENAME_BORDER_PX := 1

const WIDTH := 104.0
const PADDING := Vector2(4.0, 8.0)
const BORDER_PX := 1.0
const RADIUS := 4.0
const GAP := 8.0
const LABEL_PX := 11.5
const LABEL_MAX_WIDTH := 96.0                   # web .lbl max-width: 96px
const LINE_HEIGHT_EM := 1.25
const LABEL_SHADOW := Color(0.0, 0.0, 0.0, 1.0)
const LABEL_SHADOW_OFFSET := Vector2(0.0, 1.0)
const LABEL_SHADOW_BLUR := 4.0
const HOVER_FILL_ALPHA := 0.05
const SELECTED_FILL_ALPHA := 0.12
const INSET_BLUR := 16.0
const INSET_ALPHA := 0.16
const DROP_FILL_ALPHA := 0.10
const DASH_LENGTH_RATIO := 3.0                  # Blink StyledStrokeData for a 1 px dashed border: 3 px dashes ...
const DASH_GAP_RATIO := 2.0                     # ... 2 px gaps, stretched to fit the side (SelectBestDashGap)
const DASH_SIDE_INSET := 0.5                    # the side measured along its stroke (capture: 5.028 px apart on 104)
const SIGMA_PER_BLUR := 0.5
const HALF := 0.5

var entry := {}                                 # RadioLibrary {kind, name, path}
var selected := false:
	set(value):
		selected = value
		_restyle()
## web .rexp-it.dropok: a folder under dragged tracks — an OK-green border on OK 10%, its icon lit green.
var drop_target := false:
	set(value):
		if drop_target == value:
			return
		drop_target = value
		_icon.set_drop_target(value)
		_restyle()

var _box: ColorRect
var _icon: RadioLibraryIcon
var _label: GlowText                            # the name's first line (every line is a GlowText of its own)
var _lines: Array[GlowText] = []
var _rename: LineEdit = null
var _hovered := false

func _init(library_entry: Dictionary) -> void:
	entry = library_entry
	name = "Item"
	mouse_filter = Control.MOUSE_FILTER_STOP
	_box = ColorRect.new()
	_box.name = "Box"
	_box.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var material := ShaderMaterial.new()
	material.shader = RadioLibraryIcon.BOX_SHADER
	material.set_shader_parameter("radii", Vector4.ONE * RADIUS)
	material.set_shader_parameter("border_px", BORDER_PX)
	_box.material = material
	add_child(_box)
	_icon = RadioLibraryIcon.new(RadioLibraryIcon.FOLDER if entry[RadioLibrary.KIND] == RadioLibrary.FOLDER
		else RadioLibraryIcon.TRACK)
	add_child(_icon)
	_set_lines(wrap_lines(str(entry[RadioLibrary.NAME])))
	size = Vector2(WIDTH, natural_height())
	_restyle()
	_layout()

func path() -> String:
	return entry[RadioLibrary.PATH]

func is_folder() -> bool:
	return entry[RadioLibrary.KIND] == RadioLibrary.FOLDER

func icon() -> RadioLibraryIcon:
	return _icon

func label() -> GlowText:
	return _label

## The name's lines, top to bottom.
func label_lines() -> Array[GlowText]:
	return _lines

## web `word-break: break-word` inside `max-width: 96px`: break at spaces first, and inside a word only when it would
## not fit a line of its own.
static func wrap_lines(text: String, width := LABEL_MAX_WIDTH) -> PackedStringArray:
	var measure := func(part: String) -> float: return UiFont.css_width(part, LABEL_PX, 0.0)
	var wrapped := PackedStringArray()
	for line in CssLineBreak.lines(text, width, measure):
		if float(measure.call(line)) <= width:
			wrapped.append(line)
		else:
			wrapped.append_array(_break_word(line, width, measure))
	return wrapped if not wrapped.is_empty() else PackedStringArray([""])

static func _break_word(word: String, width: float, measure: Callable) -> PackedStringArray:
	var pieces := PackedStringArray()
	var piece := ""
	for i in word.length():
		if piece != "" and float(measure.call(piece + word[i])) > width:
			pieces.append(piece)
			piece = ""
		piece += word[i]
	if piece != "":
		pieces.append(piece)
	return pieces

## The cell's own height: the border, the padding, the icon, the gap and the name's lines (or its edit field).
func natural_height() -> float:
	return 2.0 * (BORDER_PX + PADDING.y) + _icon.size.y + GAP \
		+ (rename_height() if _rename != null else line_px() * _lines.size())

static func line_px() -> float:
	return LABEL_PX * LINE_HEIGHT_EM

## Blink SelectBestDashGap for an open stroke `length` long: the gap nearest `gap` that starts and ends it on a dash.
static func dash_gap(length: float, dash: float, gap: float) -> float:
	var fewer := floorf((length + gap) / (dash + gap))
	var fewer_gap := (length - fewer * dash) / (fewer - 1.0)
	var more_gap := (length - (fewer + 1.0) * dash) / fewer
	return fewer_gap if more_gap <= 0.0 or absf(fewer_gap - gap) < absf(more_gap - gap) else more_gap

## The edit field's border box: the UI font's line at 11 px, the input padding and border.
static func rename_height() -> float:
	return roundi(UiFont.ASCENT_EM * RENAME_PX) + roundi(UiFont.DESCENT_EM * RENAME_PX) \
		+ 2.0 * (RENAME_PADDING.y + RENAME_BORDER_PX)

func rename_field() -> LineEdit:
	return _rename

## The name as an edit field, focused with the caret at the end: Enter or leaving it commits, Escape cancels.
func begin_rename() -> LineEdit:
	if _rename != null:
		return _rename
	_rename = LineEdit.new()
	_rename.name = "Rename"
	_rename.text = str(entry[RadioLibrary.NAME])
	_rename.alignment = HORIZONTAL_ALIGNMENT_CENTER
	var font_size := UiFont.css_size(RENAME_PX)
	_rename.add_theme_font_override("font", UiFont.with_css_line(UiFont.spaced(0.0, font_size, RENAME_PX), font_size,
		RENAME_PX))
	_rename.add_theme_font_size_override("font_size", font_size)
	_rename.add_theme_color_override("font_color", UiTokens.TEXT)
	var box := StyleBoxFlat.new()
	box.bg_color = RENAME_FILL
	box.border_color = UiTokens.ACCENT
	box.set_border_width_all(RENAME_BORDER_PX)
	box.set_corner_radius_all(RENAME_RADIUS)
	box.content_margin_left = RENAME_PADDING.x + RENAME_BORDER_PX
	box.content_margin_right = RENAME_PADDING.x + RENAME_BORDER_PX
	box.content_margin_top = RENAME_PADDING.y + RENAME_BORDER_PX
	box.content_margin_bottom = RENAME_PADDING.y + RENAME_BORDER_PX
	for state in ["normal", "focus", "read_only"]:
		_rename.add_theme_stylebox_override(state, box)
	_rename.text_submitted.connect(func(_text: String) -> void: finish_rename(true))
	_rename.focus_exited.connect(func() -> void: finish_rename(true))
	_rename.gui_input.connect(func(event: InputEvent) -> void:   # before the field's own keys: Escape cancels
		var key := event as InputEventKey
		if key != null and key.pressed and key.keycode == KEY_ESCAPE:
			finish_rename(false))
	_show_lines(false)
	add_child(_rename)
	_rename.caret_column = _rename.text.length()
	_rename.grab_focus.call_deferred()
	_layout()
	return _rename

## The edit ends: the field goes, the name comes back, and the explorer hears what was typed.
func finish_rename(committed: bool) -> void:
	if _rename == null:
		return
	var field := _rename
	_rename = null
	var typed := field.text
	field.queue_free()
	_show_lines(true)
	_layout()
	rename_finished.emit(self, typed, committed)

func _gui_input(event: InputEvent) -> void:
	var click := event as InputEventMouseButton
	if click == null or not click.pressed:
		return
	if click.button_index == MOUSE_BUTTON_LEFT and click.double_click:
		opened.emit(self)
	elif click.button_index in [MOUSE_BUTTON_LEFT, MOUSE_BUTTON_RIGHT]:
		pressed.emit(self, click)
	accept_event()                                 # web stopPropagation: the window's own menu stays shut

func _notification(what: int) -> void:
	if what == NOTIFICATION_MOUSE_ENTER or what == NOTIFICATION_MOUSE_EXIT:
		_hovered = what == NOTIFICATION_MOUSE_ENTER
		if what == NOTIFICATION_MOUSE_EXIT:
			drop_target = false                      # web dragleave
		_restyle()
	elif what == NOTIFICATION_DRAG_END:
		drop_target = false
	elif what == NOTIFICATION_RESIZED or what == NOTIFICATION_READY:   # a row as tall as before sends no resize
		_layout()

func _restyle() -> void:
	if _box == null:
		return
	var material := _box.material as ShaderMaterial
	var fill := Color(0.0, 0.0, 0.0, 0.0)
	var border := Color(0.0, 0.0, 0.0, 0.0)
	var inset := 0.0
	if selected:
		fill = Color(UiTokens.ACCENT, SELECTED_FILL_ALPHA)
		border = UiTokens.ACCENT
		inset = INSET_BLUR * SIGMA_PER_BLUR
	elif _hovered:
		fill = Color(UiTokens.ACCENT, HOVER_FILL_ALPHA)
		border = UiTokens.GHOST_LINE_HOVER
	if drop_target:                                  # .dropok comes after .sel: its border and background win
		fill = Color(UiTokens.OK, DROP_FILL_ALPHA)
		border = UiTokens.OK
	var dash := BORDER_PX * DASH_LENGTH_RATIO
	material.set_shader_parameter("dash_px", dash if drop_target else 0.0)
	material.set_shader_parameter("dash_gap_px", dash_gap(size.x - DASH_SIDE_INSET, dash, BORDER_PX * DASH_GAP_RATIO))
	material.set_shader_parameter("top_color", fill)
	material.set_shader_parameter("bottom_color", fill)
	material.set_shader_parameter("border_color", border)
	material.set_shader_parameter("inset_sigma", inset)
	material.set_shader_parameter("inset_color", Color(UiTokens.ACCENT, INSET_ALPHA))

func _layout() -> void:
	if _label == null:
		return
	_box.size = size
	(_box.material as ShaderMaterial).set_shader_parameter("box_px", size)
	var top := BORDER_PX + PADDING.y
	_icon.position = Vector2(CssPixel.snap((size.x - _icon.size.x) * HALF), top)
	var line_top := top + _icon.size.y + GAP
	for i in _lines.size():
		var line := _lines[i]
		var text := line.get_combined_minimum_size()
		var text_left := (size.x - text.x) * HALF              # text-align: center keeps Chrome's fractional left
		line.position = Vector2(floorf(text_left), line_top + i * line_px() + floorf((line_px() - text.y) * HALF))
		line.css_offset_x = text_left - line.position.x
	if _rename != null:
		_rename.size = Vector2(RENAME_WIDTH, rename_height())
		_rename.position = Vector2((size.x - RENAME_WIDTH) * HALF, line_top)

## One GlowText per wrapped line, reusing what is already there.
func _set_lines(texts: PackedStringArray) -> void:
	while _lines.size() > texts.size():
		(_lines.pop_back() as GlowText).queue_free()
	while _lines.size() < texts.size():
		var line := GlowText.new()
		line.name = "Label" if _lines.is_empty() else "Label%d" % _lines.size()
		line.configure_css(LABEL_PX, 0.0, UiTokens.TEXT)
		line.set_shadows([CssShadow.make(LABEL_SHADOW_BLUR, LABEL_SHADOW, LABEL_SHADOW_OFFSET)])
		line.minimum_size_changed.connect(_layout)   # the name's box settles once the theme fonts apply
		add_child(line)
		_lines.append(line)
	for i in texts.size():
		_lines[i].set_text(texts[i])
	_label = _lines[0]

func _show_lines(shown: bool) -> void:
	for line in _lines:
		line.visible = shown
