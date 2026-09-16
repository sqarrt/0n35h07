class_name RadioPlayer extends Control
## The Radio player — port of web components/RadioPlayer: one glass.ts card 300 px wide (12 / 16 px padding, a 9 px gap).
## Docked on the menu screens it is shrunk to 0.8 into the corner 18 px from the right and 44 px from the bottom
## (transform-origin bottom right) with the track name — click it to open the radio — over prev / play-pause / next.
## Expanded on the Radio screen it sits centred along the bottom at full size with the subtitle, the scrub row, the
## transport, On Air and the ball toggle, the volume, the free-trial strip and the daily-limit line, and the glass BACK
## bar 8 px under the card. One 0.34 s cubic-bezier(0.2, 0.8, 0.2, 1) transform moves it between the two while the
## content swaps at once. Until the engine is ready the subtitle, the scrub row, the transport and the On Air row dim
## to 0.45 and let the mouse through.

signal play_pause_requested
signal prev_requested
signal next_requested
signal open_requested
signal seek_requested(fraction: float)
signal volume_changed(value: float)
signal air_requested
signal ball_toggled
signal unlock_requested
signal back_requested
signal code_bar_pressed
signal library_bar_pressed

const WIDTH := 300.0
const RIGHT := 18.0
const BOTTOM := 44.0
const COLLAPSED_SCALE := 0.8
const EXPAND_S := 0.34
const EXPAND_CURVE := [0.2, 0.8, 0.2, 1.0]
const PADDING := Vector2(16.0, 12.0)
const GAP := 9.0
const ROOT_GAP := 8.0                          # between the card and the BACK bar
const ROW_GAP := 8.0
const BUTTON_HEIGHT := 38.0
const BUTTON_RADIUS := 10
const BUTTON_BORDER := Color(1.0, 1.0, 1.0, 0.14)
const BUTTON_TEXT := Color("#ccdddd")          # #cdd
const BUTTON_PX := 16.8                        # 1.05rem
const TITLE_PX := 14.72                        # 0.92rem
const TITLE_SPACING_EM := 0.05
const TITLE_COLOR := Color("#eeeeff")          # #eef
const SUBTITLE_PX := 11.2                      # 0.7rem
const SUBTITLE_SPACING_EM := 0.12
const DIM_OPACITY := 0.45
const PREV_GLYPH := "⏮"
const PLAY_GLYPH := "▶"
const PAUSE_GLYPH := "⏸"
const NEXT_GLYPH := "⏭"
const SYMBOL_FAMILIES := ["Segoe UI Symbol"]   # the transport glyphs are not in the UI font (Chrome's system fallback)
const AIR_HEIGHT := 32.0
const AIR_PX := 11.52                          # 0.72rem
const AIR_SPACING_EM := 0.08
const AIR_LABEL := "◉ %s"
const AIR_FAMILIES := ["Cambria Math"]         # Chrome's face for ◉
const AIR_ON_BORDER_ALPHA := 0.45
const AIR_ON_FILL_ALPHA := 0.10
const AIR_ON_GLOW_ALPHA := 0.15
const AIR_GLOW_BLUR := 10.0
const AIR_OFF_TEXT := Color("#bbccdd")         # #bcd
const BALL_WIDTH := 34.0
const BALL_PX := 14.4                          # 0.9rem
const BALL_SHOWN := "⬤"
const BALL_HIDDEN := "◯"
const LIMIT_PX := 10.24                        # 0.64rem
const LIMIT_SPACING_EM := 0.04
const LIMIT_COLOR := Color("#ee99aa")          # #e9a
const LIMIT_MARGIN_TOP := 2.0
const BACK_LABEL := "← %s"
const PROGRAM_KEY := "radioProgram"
const LIBRARY_KEY := "radioLibrary"
const SAVE_LIMIT_KEY := "radioSaveLimit"
const BAR_CODE := "code"                       # web lastMin: which minimized window's bar sits on top
const BAR_LIBRARY := "lib"
const DRAG_PREVIEW_ALPHA := 0.6                # the browser's translucent drag image of the cassette
const DRAG_PREVIEW_GRAB := Vector2(26.0, 17.0) # web setDragImage(ghost, 26, 17)
const BAR_ENTER_S := 0.2                       # web rexp-bar-in: the bar rises 12 px and fades in
const BAR_ENTER_RISE := 12.0
const RADIO_WORD_KEY := "settingsVolRadio"     # web radioWord: the subtitle before a track
const AIR_KEY := "radioAir"
const BACK_KEY := "settingsBack"
const GEN_LIMIT_KEY := "radioGenLimit"
const TRIAL_GENS := "gens_left"
const TRIAL_SAVES := "saves_left"
const HALF := 0.5

var _glass: GlassCard
var _title: CssLabel
var _subtitle: CssLabel
var _scrub: RadioScrub
var _row: Control
var _prev: CssButton
var _play: CssButton
var _next: CssButton
var _air_row: Control
var _air_glow: ColorRect
var _air: CssButton
var _ball: CssButton
var _volume: RadioVolumeRow
var _trial: RadioTrialRow
var _limit: CssLabel
var _back: RadioGlassButton
## web onDragTrack: the audible track as a library payload ({} when nothing can be saved).
var track_payload := func() -> Dictionary: return {}

var _code_bar: RadioGlassButton
var _library_bar: RadioGlassButton
var _bars := {}                                # BAR_CODE / BAR_LIBRARY → the bar
var _bar_shown := {BAR_CODE: false, BAR_LIBRARY: false}
var _bar_in := {BAR_CODE: CssTransition.new(BAR_ENTER_S, EXPAND_CURVE), BAR_LIBRARY: CssTransition.new(BAR_ENTER_S, EXPAND_CURVE)}
var _last_minimized := ""
var _save_limit: CssLabel
var _save_limited := false
var _drag_surface: Control
var _card_top := 0.0
var _card := Vector2(WIDTH, 0.0)
var _box := Vector2(WIDTH, 0.0)                # the whole player: the card, and BACK under it when expanded
var _expanded := false
var _expand := CssTransition.new(EXPAND_S, EXPAND_CURVE)
var _has_trial := false
var _gen_limited := false
var _subtitle_text := ""

func _init() -> void:
	name = "RadioPlayer"
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	_glass = GlassCard.new()
	add_child(_glass)
	_drag_surface = Control.new()                 # web draggable card: the empty areas carry the track to the library
	_drag_surface.name = "DragSurface"
	_drag_surface.mouse_filter = Control.MOUSE_FILTER_PASS
	_drag_surface.set_drag_forwarding(func(_at: Vector2) -> Variant: return drag_data(), Callable(), Callable())
	add_child(_drag_surface)
	_title = CssLabel.new().styled(RadioModel.NO_TRACK, TITLE_PX, TITLE_SPACING_EM, TITLE_COLOR)
	_title.name = "TrackName"
	_title.mouse_filter = Control.MOUSE_FILTER_STOP   # the collapsed name opens the radio
	_title.gui_input.connect(_on_title_input)
	add_child(_title)
	_subtitle = CssLabel.new().styled("", SUBTITLE_PX, SUBTITLE_SPACING_EM, UiTokens.ACCENT_DIM)
	_subtitle.name = "Subtitle"
	_subtitle.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	add_child(_subtitle)
	_scrub = RadioScrub.new()
	_scrub.seek_requested.connect(func(fraction: float) -> void: seek_requested.emit(fraction))
	add_child(_scrub)
	_row = _container("Transport")
	_prev = _transport_button("Prev", PREV_GLYPH, prev_requested)
	_play = _transport_button("PlayPause", PLAY_GLYPH, play_pause_requested)
	_next = _transport_button("Next", NEXT_GLYPH, next_requested)
	_add_air_row()
	_volume = RadioVolumeRow.new()
	_volume.volume_changed.connect(func(value: float) -> void: volume_changed.emit(value))
	add_child(_volume)
	_trial = RadioTrialRow.new()
	_trial.unlock_requested.connect(func() -> void: unlock_requested.emit())
	add_child(_trial)
	_limit = CssLabel.new().styled("", LIMIT_PX, LIMIT_SPACING_EM, LIMIT_COLOR)
	_limit.name = "GenLimit"
	_limit.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	add_child(_limit)
	_save_limit = CssLabel.new().styled("", LIMIT_PX, LIMIT_SPACING_EM, LIMIT_COLOR)
	_save_limit.name = "SaveLimit"
	_save_limit.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	add_child(_save_limit)
	_back = RadioGlassButton.new("", RadioGlassButton.ARROW_FAMILIES)
	_back.name = "Back"
	_back.pressed.connect(func() -> void: back_requested.emit())
	add_child(_back)
	_code_bar = RadioGlassButton.new("")
	_code_bar.name = "ProgramBar"
	_code_bar.pressed.connect(func() -> void: code_bar_pressed.emit())
	add_child(_code_bar)
	_library_bar = RadioGlassButton.new("")
	_library_bar.name = "LibraryBar"
	_library_bar.pressed.connect(func() -> void: library_bar_pressed.emit())
	add_child(_library_bar)
	_bars = {BAR_CODE: _code_bar, BAR_LIBRARY: _library_bar}
	for entrance: CssTransition in _bar_in.values():
		entrance.snap(1.0)
	relabel()
	show_air(true)
	show_ball_hidden(false)
	_expand.snap(0.0)
	set_process(false)
	_layout()

## What the player shows: the track label, whether the engine is ready, whether the radio is switched on.
func show_state(label: String, ready: bool, playing: bool) -> void:
	_title.text = label
	_play.text = PAUSE_GLYPH if playing else PLAY_GLYPH
	for dimmed: CanvasItem in [_subtitle, _scrub, _row, _air_row]:
		dimmed.modulate.a = 1.0 if ready else DIM_OPACITY
	var filter := Control.MOUSE_FILTER_STOP if ready else Control.MOUSE_FILTER_IGNORE
	for control: Control in transport_buttons() + [_scrub, _air, _ball]:
		control.mouse_filter = filter
	_layout()

## The expanded player's track facts: "BPM · key scale" (the radio's name before a track), the play position and length.
func show_details(subtitle: String, progress: float, total_ms: float) -> void:
	_subtitle_text = subtitle
	_subtitle.text = subtitle if subtitle != "" else I18n.t(RADIO_WORD_KEY)
	_scrub.show_progress(progress, total_ms)
	_layout()

func show_volume(value: float) -> void:
	_volume.set_volume(value)

## The free-trial strip ({gens_left, saves_left}, empty: none), its unlock button, the "daily generations used up" line.
func show_trial(strip: Dictionary, can_unlock: bool, gen_limited: bool) -> void:
	_has_trial = not strip.is_empty()
	if _has_trial:
		_trial.show_trial(int(strip[TRIAL_GENS]), int(strip[TRIAL_SAVES]), can_unlock)
	_gen_limited = gen_limited
	_layout()

## On Air lit while the live generative stream is the source.
func show_air(on: bool) -> void:
	var border := Color(UiTokens.OK, AIR_ON_BORDER_ALPHA) if on else BUTTON_BORDER
	var fill := Color(UiTokens.OK, AIR_ON_FILL_ALPHA) if on else Color(0.0, 0.0, 0.0, 0.0)
	RadioButtons.dress(_air, RadioButtons.outline(border, BUTTON_RADIUS, fill), UiTokens.OK if on else AIR_OFF_TEXT)
	_air_glow.visible = on

func show_ball_hidden(hidden: bool) -> void:
	_ball.text = BALL_HIDDEN if hidden else BALL_SHOWN

## The PROGRAM bar over the card while the code window is minimized (it rises in as it appears).
func show_code_bar(shown: bool) -> void:
	_show_bar(BAR_CODE, shown)

## The LIBRARY bar over the card while the library window is minimized.
func show_library_bar(shown: bool) -> void:
	_show_bar(BAR_LIBRARY, shown)

## web lastMin: the bar of the window minimized last sits on top of the stack.
func set_last_minimized(bar: String) -> void:
	_last_minimized = bar
	_layout()

## web saveLimited: "Daily free saves used up" under the card's rows while a refused save's prompt lasts.
func show_save_limited(on: bool) -> void:
	_save_limited = on
	_layout()

func code_bar() -> RadioGlassButton:
	return _code_bar

func library_bar() -> RadioGlassButton:
	return _library_bar

func save_limit_label() -> CssLabel:
	return _save_limit

## web onDragStart on the expanded card: the audible track (and the cassette as the drag image), or no drag.
func drag_data() -> Variant:
	if not _expanded:
		return null
	var payload: Dictionary = track_payload.call()
	if payload.is_empty():
		return null
	if get_viewport() != null and get_viewport().gui_is_dragging():
		var holder := Control.new()
		var cassette := RadioLibraryIcon.new(RadioLibraryIcon.TRACK)
		cassette.position = -DRAG_PREVIEW_GRAB
		cassette.modulate.a = DRAG_PREVIEW_ALPHA
		holder.add_child(cassette)
		_drag_surface.set_drag_preview(holder)
	return {RadioExplorer.DRAG_TRACK: payload}

func _show_bar(bar: String, shown: bool) -> void:
	if shown and not _bar_shown[bar]:
		var entrance: CssTransition = _bar_in[bar]
		entrance.snap(0.0)
		entrance.set_target(1.0)
		set_process(true)
	_bar_shown[bar] = shown
	_layout()

func _bar_order() -> Array:
	return [BAR_CODE, BAR_LIBRARY] if _last_minimized == BAR_CODE else [BAR_LIBRARY, BAR_CODE]

## Where the card starts inside the player: under the bars when any are shown.
func card_top() -> float:
	return _card_top

## Docked (false) or expanded on the Radio screen (true); `animate` runs the transform transition.
func set_expanded(expanded: bool, animate := true) -> void:
	_expanded = expanded
	_title.mouse_default_cursor_shape = Control.CURSOR_ARROW if expanded else Control.CURSOR_POINTING_HAND
	# expanded, the name is part of the draggable card; docked, it opens the radio
	_title.mouse_filter = Control.MOUSE_FILTER_IGNORE if expanded else Control.MOUSE_FILTER_STOP
	_drag_surface.mouse_default_cursor_shape = Control.CURSOR_DRAG if expanded else Control.CURSOR_ARROW
	_drag_surface.visible = expanded
	if animate:
		_expand.set_target(1.0 if expanded else 0.0)
		set_process(true)
	else:
		_expand.snap(1.0 if expanded else 0.0)
	_layout()

func is_expanded() -> bool:
	return _expanded

## The texts in the active language (web re-renders on a locale change).
func relabel() -> void:
	_air.text = AIR_LABEL % I18n.t(AIR_KEY)
	_back.button().text = BACK_LABEL % I18n.t(BACK_KEY)
	_code_bar.button().text = I18n.t(PROGRAM_KEY)
	_library_bar.button().text = I18n.t(LIBRARY_KEY)
	_limit.text = I18n.t(GEN_LIMIT_KEY)
	_save_limit.text = I18n.t(SAVE_LIMIT_KEY)
	_subtitle.text = _subtitle_text if _subtitle_text != "" else I18n.t(RADIO_WORD_KEY)
	_layout()

func card_box() -> Vector2:
	return _card

func transport_buttons() -> Array:
	return [_prev, _play, _next]

func transport_row() -> Control:
	return _row

func title_text() -> String:
	return _title.text

func subtitle_label() -> CssLabel:
	return _subtitle

func scrub() -> RadioScrub:
	return _scrub

func air_button() -> CssButton:
	return _air

func ball_button() -> CssButton:
	return _ball

func volume_row() -> RadioVolumeRow:
	return _volume

func trial_row() -> RadioTrialRow:
	return _trial

func limit_label() -> CssLabel:
	return _limit

func back_bar() -> RadioGlassButton:
	return _back

func request_open() -> void:
	open_requested.emit()

func _notification(what: int) -> void:
	if what == NOTIFICATION_PARENTED:
		set_anchors_preset(Control.PRESET_BOTTOM_RIGHT)
		_layout()

func _process(delta: float) -> void:
	_expand.advance(delta)
	var settled := is_equal_approx(_expand.value, _expand.target())
	for entrance: CssTransition in _bar_in.values():
		entrance.advance(delta)
		settled = settled and is_equal_approx(entrance.value, entrance.target())
	_layout()
	if settled:
		set_process(false)

func _on_title_input(event: InputEvent) -> void:
	var click := event as InputEventMouseButton
	if not _expanded and click != null and click.pressed and click.button_index == MOUSE_BUTTON_LEFT:
		request_open()

## The card's rows top to bottom: [control, height, margin above]; the expanded rows only on the Radio screen.
func _rows() -> Array:
	var rows := [[_title, _title.css_size().y, 0.0]]
	if _expanded:
		rows.append([_subtitle, _subtitle.css_size().y, 0.0])
		rows.append([_scrub, RadioScrub.HEIGHT, 0.0])
	rows.append([_row, BUTTON_HEIGHT, 0.0])
	if _expanded:
		rows.append([_air_row, AIR_HEIGHT, 0.0])
		rows.append([_volume, _volume.row_height(), 0.0])
		if _has_trial:
			_trial.set_content_width(WIDTH - 2.0 * (GlassCard.BORDER_PX + PADDING.x))   # it wraps in the room it gets
			rows.append([_trial, _trial.row_height(), RadioTrialRow.MARGIN_TOP])
		if _gen_limited:
			rows.append([_limit, _limit.css_size().y, LIMIT_MARGIN_TOP])
		if _save_limited:
			rows.append([_save_limit, _save_limit.css_size().y, LIMIT_MARGIN_TOP])
	return rows

func _layout() -> void:
	if _back == null:
		return
	var left := GlassCard.BORDER_PX + PADDING.x
	var content_width := WIDTH - 2.0 * left
	# text-overflow: ellipsis — a name wider than the card trims natively
	_title.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS if _title.run() != null \
		and _title.run().width() > content_width else TextServer.OVERRUN_NO_TRIMMING
	_title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	var rows := _rows()
	# Mount what the card shows in one pass: hiding a row and showing it again drops the mouse that sits over its
	# buttons (Godot re-reads the hovered control only when the cursor moves) and cancels a press in flight.
	var mounted: Array = rows.map(func(row: Array) -> Control: return row[0])
	for control: Control in [_subtitle, _scrub, _air_row, _volume, _trial, _limit, _save_limit]:
		control.visible = mounted.has(control)
	_card_top = 0.0
	for key: String in _bar_order():                # flex column, gap 8: the bars, then the card
		var bar: RadioGlassButton = _bars[key]
		bar.visible = _expanded and _bar_shown[key]
		if bar.visible:
			var entrance: CssTransition = _bar_in[key]
			bar.size = Vector2(WIDTH, bar.bar_height())
			bar.position = Vector2(0.0, _card_top + (1.0 - entrance.value) * BAR_ENTER_RISE)
			bar.modulate.a = entrance.value
			_card_top += bar.bar_height() + ROOT_GAP
	var y := _card_top + GlassCard.BORDER_PX + PADDING.y
	for i in rows.size():
		var control: Control = rows[i][0]
		y += rows[i][2]
		control.position = Vector2(left, y)
		control.size = Vector2(content_width, rows[i][1])
		y += rows[i][1] + (GAP if i < rows.size() - 1 else 0.0)
	_layout_transport(content_width)
	_layout_air_row(content_width)
	_card = Vector2(WIDTH, y - _card_top + PADDING.y + GlassCard.BORDER_PX)
	_glass.position = Vector2(0.0, _card_top)
	_glass.set_box(_card)
	_drag_surface.position = _glass.position
	_drag_surface.size = _card
	_box = Vector2(WIDTH, _card_top + _card.y)
	_back.visible = _expanded
	if _expanded:
		_back.position = Vector2(0.0, _box.y + ROOT_GAP)
		_back.size = Vector2(WIDTH, _back.bar_height())
		_box.y += ROOT_GAP + _back.bar_height()
	_apply_transform()

## web wrap: translateX(0) scale(0.8) docked, translateX(calc(-50vw + 50% + 18px)) scale(1) expanded, from the bottom right.
## The offsets come from the player's own box: moving one offset resizes the control before the other is set.
func _apply_transform() -> void:
	var progress := _expand.value
	var viewport_width := get_parent_area_size().x
	scale = Vector2.ONE * lerpf(COLLAPSED_SCALE, 1.0, progress)
	pivot_offset = _box
	var shift := progress * (-viewport_width * HALF + _box.x * HALF + RIGHT)
	offset_right = -RIGHT + shift
	offset_bottom = -BOTTOM
	offset_left = offset_right - _box.x
	offset_top = offset_bottom - _box.y

func _layout_transport(content_width: float) -> void:
	var button_width := (content_width - ROW_GAP * (transport_buttons().size() - 1)) / transport_buttons().size()
	for i in transport_buttons().size():
		var button: CssButton = transport_buttons()[i]
		var x := i * (button_width + ROW_GAP)
		button.position = Vector2(CssPixel.snap(x), 0.0)
		button.size = Vector2(CssPixel.snap(x + button_width) - button.position.x, BUTTON_HEIGHT)

func _layout_air_row(content_width: float) -> void:
	var air_width := content_width - ROW_GAP - BALL_WIDTH
	_air.position = Vector2.ZERO
	_air.size = Vector2(air_width, AIR_HEIGHT)
	CssBoxShadow.place(_air_glow, _air.position, _air.size)
	_ball.position = Vector2(air_width + ROW_GAP, 0.0)
	_ball.size = Vector2(BALL_WIDTH, AIR_HEIGHT)

func _container(node_name: String) -> Control:
	var container := Control.new()
	container.name = node_name
	container.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(container)
	return container

func _add_air_row() -> void:
	_air_row = _container("AirRow")
	_air_glow = CssBoxShadow.make(Color(UiTokens.OK, AIR_ON_GLOW_ALPHA), AIR_GLOW_BLUR, Vector2.ZERO, 0.0, BUTTON_RADIUS)
	_air_row.add_child(_air_glow)
	_air = _icon_button("Air", AIR_PX, AIR_SPACING_EM, AIR_FAMILIES, _air_row)
	_air.pressed.connect(func() -> void: air_requested.emit())
	_ball = _icon_button("Ball", BALL_PX, 0.0, SYMBOL_FAMILIES, _air_row)
	RadioButtons.dress(_ball, RadioButtons.outline(BUTTON_BORDER, BUTTON_RADIUS), BUTTON_TEXT)
	_ball.pressed.connect(func() -> void: ball_toggled.emit())

func _transport_button(node_name: String, glyph: String, action: Signal) -> CssButton:
	var button := _icon_button(node_name, BUTTON_PX, 0.0, SYMBOL_FAMILIES, _row)
	RadioButtons.dress(button, RadioButtons.outline(BUTTON_BORDER, BUTTON_RADIUS), BUTTON_TEXT)
	button.text = glyph
	button.pressed.connect(func() -> void: action.emit())
	return button

## web iconBtn: grid-centred symbol at line-height 1, a pointer, no focus ring.
func _icon_button(node_name: String, css_px: float, spacing_em: float, families: Array, parent: Control) -> CssButton:
	var button := CssButton.new()
	button.name = node_name
	button.focus_mode = Control.FOCUS_NONE
	button.mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
	RadioButtons.set_font(button, css_px, spacing_em, families, css_px)
	RadioButtons.press_scale(button)   # web .radio-player-root button:active
	parent.add_child(button)
	return button
