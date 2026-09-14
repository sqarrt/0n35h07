class_name UiToggle extends Button
## On/off switch — port of web ui/Toggle with theme.css `.toggle`: a 34×18 box in a 1 px line border with a 12 px
## square knob 2 px inside it — on the left in accent-dim when off, on the right in ink over the accent fill when on.
## Flat, no transition; every click plays the toggle sound and flips it.

signal switched(on: bool)

const BOX_SIZE := Vector2(34.0, 18.0)
const BORDER_PX := 1.0
const KNOB_SIZE := 12.0
const KNOB_INSET := 2.0                  # .toggle-knob top / left (right when on): 2px inside the border
const HALF := 0.5
const STATES := ["normal", "hover", "pressed", "hover_pressed", "disabled", "focus"]

var checked := false

func _init(on := false) -> void:
	checked = on
	focus_mode = Control.FOCUS_NONE
	custom_minimum_size = BOX_SIZE
	for state in STATES:
		add_theme_stylebox_override(state, StyleBoxEmpty.new())
	pressed.connect(_on_pressed)

func set_checked(on: bool) -> void:
	checked = on
	queue_redraw()

## The knob inside the box (web: absolute top 2px, left 2px or right 2px within the border).
func knob_rect() -> Rect2:
	var left := BOX_SIZE.x - BORDER_PX - KNOB_INSET - KNOB_SIZE if checked else BORDER_PX + KNOB_INSET
	return Rect2(left, BORDER_PX + KNOB_INSET, KNOB_SIZE, KNOB_SIZE)

func _draw() -> void:
	var box := Rect2(Vector2.ZERO, BOX_SIZE)
	if checked:
		draw_rect(box, UiTokens.ACCENT_FILL)
	else:
		draw_rect(box.grow(-BORDER_PX * HALF), UiTokens.LINE, false, BORDER_PX)
	draw_rect(knob_rect(), UiTokens.INK if checked else UiTokens.ACCENT_DIM)

func _on_pressed() -> void:
	UiSounds.toggle()
	set_checked(not checked)
	switched.emit(checked)
