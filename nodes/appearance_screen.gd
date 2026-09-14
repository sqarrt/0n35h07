class_name AppearanceScreen extends Control
## The appearance screen — port of web screens/Appearance: every cosmetic on one scrolling page — the title, ON MODEL
## (the slot the backdrop ball shows, in its colour), the primary and reserve colour swatches, the sphere model, the
## paint tools with the front and back fields, the shot, respawn, dash-trail and shield styles — and BACK after them.
## The last clicked block (`part`) moves the backdrop camera; the preview (the edited slot's colour, the other colour as
## the planet ring, the model and the live artwork) follows every change; each change is saved at once. Style clicks
## also ask for their one-shot preview (`style_previewed`).
signal back_requested
signal profile_changed(profile: Dictionary)
signal preview_changed(spec: Dictionary, part: String)
signal style_previewed(kind: String, style: String)

const TITLE_KEY := "appearTitle"                  # web dictionary keys
const ON_MODEL_KEY := "appearOnModel"
const ON_MODEL_GAP := " "                         # the inline space before the slot
const SLOT_PRIMARY := "primary"
const SLOT_RESERVE := "reserve"
const SLOT_KEYS := {SLOT_PRIMARY: "appearSlotPrimary", SLOT_RESERVE: "appearSlotReserve"}
const PRIMARY_KEY := "appearPrimaryColor"
const RESERVE_KEY := "appearReserveColor"
const MODEL_KEY := "appearModel"
const MODEL_KEYS := {"smooth": "styleModelSmooth", "waves": "styleModelWaves", "planet": "styleModelPlanet"}
const PAINT_KEY := "appearPaint"
const BRUSH_KEY := "appearPaintBrush"
const ERASER_KEY := "appearPaintEraser"
const FRONT_KEY := "appearPaintFront"
const BACK_SIDE_KEY := "appearPaintBack"
const BACK_KEY := "appearBack"
## The style blocks in page order: [profile key, label key, options with their text keys, part].
const STYLE_GROUPS := [
	["windupStyle", "appearShotAnim",
		{"classic": "styleWindupClassic", "rage": "styleWindupRage", "singularity": "styleWindupSingularity"},
		MenuCameraRig.PART_SHOT],
	["respawnStyle", "appearRespawnAnim",
		{"echo": "styleRespawnEcho", "chaos": "styleRespawnChaos", "swarm": "styleRespawnSwarm"},
		MenuCameraRig.PART_RESPAWN],
	["dashStyle", "appearDashTrail", {"streak": "styleDashStreak", "wave": "styleDashWave", "rift": "styleDashRift"},
		MenuCameraRig.PART_DASH],
	["shieldStyle", "appearShield", {"dome": "styleShieldDome", "hex": "styleShieldHex", "crystal": "styleShieldCrystal"},
		MenuCameraRig.PART_SHIELD],
]
const KEY := 0
const LABEL := 1
const OPTIONS := 2
const PART := 3
const PROFILE_PRIMARY := "primaryColor"
const PROFILE_RESERVE := "reserveColor"
const PROFILE_MODEL := "ballModel"
const PROFILE_ART := "ballArt"
const ROW_GAP := 9.6                               # row: gap 0.6rem
const ROW_MARGIN_BOTTOM := 25.6                    # row: marginBottom 1.6rem
const LABEL_MARGIN_BOTTOM := 9.6                   # label: marginBottom 0.6rem
const ON_MODEL_MARGIN_BOTTOM := 28.8               # 1.8rem
const SLOT_SPACING_EM := 0.2
const PAINT_TOOLS_GAP := 6.4                       # the brush / eraser row: gap 0.4rem
const SCROLLBAR_PX := UiScroll.WIDTH_PX            # Chrome's native thin scrollbar (scrollbar-width: thin)
const HALF := 0.5
const SPACE_AROUND_SHARES := 4.0                   # justify-content: space-around, two items: four half-margins

var profile := {}
var part := MenuCameraRig.PART_COLOR
var editing := SLOT_PRIMARY
var erasing := false

var _art := {}
var _scroll: ScrollContainer
var _content: Control
var _title: Label
var _on_model: Label
var _slot: Label
var _primary_label: Label
var _primary_swatches := {}                        # colour -> ColorSwatch
var _reserve_label: Label
var _reserve_swatches := {}
var _model_label: Label
var _model_segs := {}
var _paint_label: Label
var _brush: SegButton
var _eraser: SegButton
var _front: BallPaintField
var _back_side: BallPaintField
var _style_labels: Array[Label] = []
var _style_segs: Array[Dictionary] = []            # per group: option -> SegButton
var _back: UiButton

## The profile edited in place.
func setup(edited: Dictionary) -> void:
	profile = edited
	_art = BallArt.decode(profile.get(PROFILE_ART, ""))

func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	_scroll = ScrollContainer.new()
	_scroll.name = "Body"
	_scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	UiScroll.style(_scroll.get_v_scroll_bar())
	add_child(_scroll)
	_content = Control.new()
	_content.name = "Content"
	_content.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_scroll.add_child(_content)
	_title = _add(MenuText.title("Title", I18n.t(TITLE_KEY)))
	_on_model = _add(MenuText.field_label("OnModel", I18n.t(ON_MODEL_KEY) + ON_MODEL_GAP))
	_slot = _add(MenuText.label("Slot", "", MenuText.FIELD_PX, SLOT_SPACING_EM, Color.WHITE))
	_primary_label = _add(MenuText.field_label("PrimaryLabel", I18n.t(PRIMARY_KEY)))
	_reserve_label = _add(MenuText.field_label("ReserveLabel", I18n.t(RESERVE_KEY)))
	for color in AppearanceConst.PLAYER_COLORS:
		_primary_swatches[color] = _swatch("Primary_%s" % color, color, choose_primary)
		_reserve_swatches[color] = _swatch("Reserve_%s" % color, color, choose_reserve)
	_model_label = _add(MenuText.field_label("ModelLabel", I18n.t(MODEL_KEY)))
	for model in MODEL_KEYS:
		_model_segs[model] = _seg("Model_%s" % model, I18n.t(MODEL_KEYS[model]), choose_model.bind(model))
	_paint_label = _add(MenuText.field_label("PaintLabel", I18n.t(PAINT_KEY)))
	_brush = _seg("Brush", I18n.t(BRUSH_KEY), set_erasing.bind(false))
	_eraser = _seg("Eraser", I18n.t(ERASER_KEY), set_erasing.bind(true))
	_front = _paint_field("PaintFront", I18n.t(FRONT_KEY), BallArt.FRONT, MenuCameraRig.PART_PAINT_FRONT)
	_back_side = _paint_field("PaintBack", I18n.t(BACK_SIDE_KEY), BallArt.BACK, MenuCameraRig.PART_PAINT_BACK)
	for group in STYLE_GROUPS:
		_style_labels.append(_add(MenuText.field_label("%sLabel" % group[KEY], I18n.t(group[LABEL]))))
		var segs := {}
		for option in group[OPTIONS]:
			segs[option] = _seg("%s_%s" % [group[KEY], option], I18n.t(group[OPTIONS][option]),
				choose_style.bind(group, option))
		_style_segs.append(segs)
	_back = UiButton.new(I18n.t(BACK_KEY), UiButton.GHOST)
	_back.name = "Back"
	_back.pressed.connect(func() -> void: back_requested.emit())
	_content.add_child(_back)
	_refresh()
	resized.connect(_layout)
	_layout()
	_emit_preview()

## The preview ball's look: the edited slot's colour, the other as the ring (web previewColor / previewRingColor).
func preview_spec() -> Dictionary:
	var primary: String = profile[PROFILE_PRIMARY]
	var reserve: String = profile[PROFILE_RESERVE]
	return {"color": primary if editing == SLOT_PRIMARY else reserve, "model": profile[PROFILE_MODEL],
		"ring": reserve if editing == SLOT_PRIMARY else primary, "art": BallArt.encode(_art),
		"windup": profile[STYLE_GROUPS[0][KEY]], "respawn": profile[STYLE_GROUPS[1][KEY]],
		"dash": profile[STYLE_GROUPS[2][KEY]], "shield": profile[STYLE_GROUPS[3][KEY]]}

## web handlePrimary: a primary colour equal to the reserve pushes the reserve to the first other palette colour.
func choose_primary(color: String) -> void:
	if color != profile[PROFILE_PRIMARY]:
		UiSounds.toggle()
	editing = SLOT_PRIMARY
	part = MenuCameraRig.PART_COLOR
	profile[PROFILE_PRIMARY] = color
	if profile[PROFILE_RESERVE] == color:
		profile[PROFILE_RESERVE] = AppearanceConst.PLAYER_COLORS.filter(func(c: String) -> bool: return c != color)[0]
	_commit()

## web handleReserve: picking the primary colour only switches the slot shown.
func choose_reserve(color: String) -> void:
	editing = SLOT_RESERVE
	part = MenuCameraRig.PART_COLOR
	if color == profile[PROFILE_PRIMARY]:
		_refresh()
		_emit_preview()
		return
	if color != profile[PROFILE_RESERVE]:
		UiSounds.toggle()
	profile[PROFILE_RESERVE] = color
	_commit()

func choose_model(model: String) -> void:
	if model != profile[PROFILE_MODEL]:
		UiSounds.toggle()
	profile[PROFILE_MODEL] = model
	part = MenuCameraRig.PART_MODEL
	_commit()

## web styleField: the style, its camera part and its one-shot preview.
func choose_style(group: Array, option: String) -> void:
	if option != profile.get(group[KEY]):
		UiSounds.toggle()
	profile[group[KEY]] = option
	part = group[PART]
	_commit()
	style_previewed.emit(group[PART], option)   # after the new style reached the preview (web: atomically)

func set_erasing(on: bool) -> void:
	if on != erasing:
		UiSounds.toggle()
	erasing = on
	_front.erasing = on
	_back_side.erasing = on
	_refresh()

## One stroke on a side (web paintFront / paintBack).
func paint(side: String, cx: int, cy: int, value: int) -> void:
	part = MenuCameraRig.PART_PAINT_FRONT if side == BallArt.FRONT else MenuCameraRig.PART_PAINT_BACK
	var grid: PackedByteArray = _art[side]   # a packed array is a value: write the changed copy back
	grid[cy * BallArt.SIZE + cx] = value
	_art[side] = grid
	_commit_art()

func clear_side(side: String) -> void:
	part = MenuCameraRig.PART_PAINT_FRONT if side == BallArt.FRONT else MenuCameraRig.PART_PAINT_BACK
	_art[side] = BallArt.empty()[side]
	UiSounds.toggle()
	_commit_art()

func body() -> ScrollContainer:
	return _scroll

func _commit_art() -> void:
	var encoded := BallArt.encode(_art)
	if encoded.is_empty():
		profile.erase(PROFILE_ART)                   # web: an empty artwork is saved as undefined
	else:
		profile[PROFILE_ART] = encoded
	_front.set_grid(_art[BallArt.FRONT])
	_back_side.set_grid(_art[BallArt.BACK])
	_commit()

func _commit() -> void:
	_refresh()
	profile_changed.emit(profile)
	_emit_preview()

func _emit_preview() -> void:
	preview_changed.emit(preview_spec(), part)

func _refresh() -> void:
	var primary: String = profile[PROFILE_PRIMARY]
	var reserve: String = profile[PROFILE_RESERVE]
	for color in _primary_swatches:
		(_primary_swatches[color] as ColorSwatch).set_selected(color == primary)
		(_reserve_swatches[color] as ColorSwatch).set_selected(color == reserve)
		(_reserve_swatches[color] as ColorSwatch).set_dimmed(color == primary)
	_slot.text = I18n.t(SLOT_KEYS[editing])
	_slot.add_theme_color_override("font_color", Color(preview_spec()["color"]))
	for model in _model_segs:
		(_model_segs[model] as SegButton).set_on(model == profile[PROFILE_MODEL])
	_brush.set_on(not erasing)
	_eraser.set_on(erasing)
	for i in STYLE_GROUPS.size():
		for option in _style_segs[i]:
			(_style_segs[i][option] as SegButton).set_on(option == profile.get(STYLE_GROUPS[i][KEY]))

func _layout() -> void:
	_scroll.position = Vector2.ZERO
	_scroll.size = size
	var width := size.x - SCROLLBAR_PX
	var y := get_viewport_rect().size.y * MenuText.SCREEN_TOP_SHARE
	y = _place(_title, 0.0, y) + MenuText.TITLE_MARGIN_BOTTOM
	var on_model := _on_model.get_combined_minimum_size()
	_set_box(_on_model, 0.0, y, on_model)
	_set_box(_slot, on_model.x, y, _slot.get_combined_minimum_size())
	y += on_model.y + ON_MODEL_MARGIN_BOTTOM
	y = _place(_primary_label, 0.0, y) + LABEL_MARGIN_BOTTOM
	y = _place_row(_primary_swatches.values(), y, ROW_GAP) + ROW_MARGIN_BOTTOM
	y = _place(_reserve_label, 0.0, y) + LABEL_MARGIN_BOTTOM
	y = _place_row(_reserve_swatches.values(), y, ROW_GAP) + ROW_MARGIN_BOTTOM
	y = _place(_model_label, 0.0, y) + LABEL_MARGIN_BOTTOM
	y = _place_row(_model_segs.values(), y, ROW_GAP) + ROW_MARGIN_BOTTOM
	y = _place(_paint_label, 0.0, y) + LABEL_MARGIN_BOTTOM
	y = _place_row([_brush, _eraser], y, PAINT_TOOLS_GAP) + ROW_MARGIN_BOTTOM
	var field := _front.get_combined_minimum_size()
	var margin := (width - 2.0 * field.x - ROW_GAP) / SPACE_AROUND_SHARES
	_set_box(_front, margin, y, field)
	_set_box(_back_side, margin * 3.0 + field.x + ROW_GAP, y, field)
	y += field.y + ROW_MARGIN_BOTTOM
	for i in STYLE_GROUPS.size():
		y = _place(_style_labels[i], 0.0, y) + LABEL_MARGIN_BOTTOM
		y = _place_row(_style_segs[i].values(), y, ROW_GAP) + ROW_MARGIN_BOTTOM
	# BACK follows the blocks (marginTop: auto only matters when the page is shorter than the panel)
	var back_height := _back.get_combined_minimum_size().y   # a Chinese label's taller line grows the button
	var back_top := maxf(y, size.y - UiButton.MARGIN_Y - back_height)
	_back.custom_minimum_size.x = width
	_set_box(_back, 0.0, back_top, Vector2(width, back_height))
	_content.custom_minimum_size = Vector2(width, back_top + back_height + UiButton.MARGIN_Y)
	_content.size = _content.custom_minimum_size

func _place_row(controls: Array, top: float, gap: float) -> float:
	var x := 0.0
	var height := 0.0
	for control in controls:
		var box := (control as Control).get_combined_minimum_size()
		_set_box(control, x, top, box)
		x += box.x + gap
		height = maxf(height, box.y)
	return top + height

func _place(label: Label, x: float, y: float) -> float:
	var box := label.get_combined_minimum_size()
	_set_box(label, x, y, box)
	return y + box.y

func _set_box(control: Control, x: float, y: float, box: Vector2) -> void:
	control.position = Vector2(CssPixel.snap(x), CssPixel.snap(y))
	control.size = box

func _add(label: Label) -> Label:
	_content.add_child(label)
	return label

func _swatch(node_name: String, color: String, on_pick: Callable) -> ColorSwatch:
	var swatch := ColorSwatch.new(Color(color))
	swatch.name = node_name
	swatch.pressed.connect(on_pick.bind(color))
	_content.add_child(swatch)
	return swatch

func _seg(node_name: String, text: String, on_press: Callable) -> SegButton:
	var seg := SegButton.new(text)
	seg.name = node_name
	seg.pressed.connect(on_press)
	_content.add_child(seg)
	return seg

func _paint_field(node_name: String, caption: String, side: String, side_part: String) -> BallPaintField:
	var field := BallPaintField.new(caption, _art[side])
	field.name = node_name
	field.painted.connect(func(cx: int, cy: int, value: int) -> void: paint(side, cx, cy, value))
	field.cleared.connect(clear_side.bind(side))
	_content.add_child(field)
	field.size = field.get_combined_minimum_size()
	return field
