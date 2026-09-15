class_name RadioLibraryItem extends Control
## One cell of the Radio library grid — web RadioExplorer `.rexp-it`: 104 px wide, 8px 4px of padding inside a 1 px
## transparent border (radius 4), the icon centred on top and 8 px under it the name (11.5 px at line-height 1.25,
## centred, --text with a 0 1px 4px black text-shadow, at most 96 px). The mouse over it: a ghost-line-hover border on
## accent 5%; selected: an accent border on accent 12% with a 16 px accent-16% inset glow.

signal pressed(item: RadioLibraryItem, event: InputEventMouseButton)
signal opened(item: RadioLibraryItem)

const WIDTH := 104.0
const PADDING := Vector2(4.0, 8.0)
const BORDER_PX := 1.0
const RADIUS := 4.0
const GAP := 8.0
const LABEL_PX := 11.5
const LINE_HEIGHT_EM := 1.25
const LABEL_SHADOW := Color(0.0, 0.0, 0.0, 1.0)
const LABEL_SHADOW_OFFSET := Vector2(0.0, 1.0)
const LABEL_SHADOW_BLUR := 4.0
const HOVER_FILL_ALPHA := 0.05
const SELECTED_FILL_ALPHA := 0.12
const INSET_BLUR := 16.0
const INSET_ALPHA := 0.16
const SIGMA_PER_BLUR := 0.5
const HALF := 0.5

var entry := {}                                 # RadioLibrary {kind, name, path}
var selected := false:
	set(value):
		selected = value
		_restyle()

var _box: ColorRect
var _icon: RadioLibraryIcon
var _label: GlowText
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
	_label = GlowText.new()
	_label.name = "Label"
	_label.configure_css(LABEL_PX, 0.0, UiTokens.TEXT)
	_label.set_shadows([CssShadow.make(LABEL_SHADOW_BLUR, LABEL_SHADOW, LABEL_SHADOW_OFFSET)])
	_label.set_text(str(entry[RadioLibrary.NAME]))
	_label.minimum_size_changed.connect(_layout)   # the name's box settles once the theme fonts apply
	add_child(_label)
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

## The cell's own height: the border, the padding, the icon, the gap and the name's line.
func natural_height() -> float:
	return 2.0 * (BORDER_PX + PADDING.y) + _icon.size.y + GAP + line_px()

static func line_px() -> float:
	return LABEL_PX * LINE_HEIGHT_EM

func _gui_input(event: InputEvent) -> void:
	var click := event as InputEventMouseButton
	if click == null or not click.pressed:
		return
	if click.button_index == MOUSE_BUTTON_LEFT and click.double_click:
		opened.emit(self)
	elif click.button_index in [MOUSE_BUTTON_LEFT, MOUSE_BUTTON_RIGHT]:
		pressed.emit(self, click)

func _notification(what: int) -> void:
	if what == NOTIFICATION_MOUSE_ENTER or what == NOTIFICATION_MOUSE_EXIT:
		_hovered = what == NOTIFICATION_MOUSE_ENTER
		_restyle()
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
	var text := _label.get_combined_minimum_size()
	var line_top := top + _icon.size.y + GAP
	var text_left := (size.x - text.x) * HALF                  # text-align: center keeps Chrome's fractional left
	_label.position = Vector2(floorf(text_left), line_top + floorf((line_px() - text.y) * HALF))
	_label.css_offset_x = text_left - _label.position.x
