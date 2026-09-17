class_name UiSounds
## Interface sounds like the web: ui/Button clicks when pressed and blips when an enabled button is hovered; pickers
## (web MapPicker / ModeCarousel) play the toggle sound on a new choice. Sounds go through the Audio autoload.

const CLICK := "ui_click"
const HOVER := "ui_hover"
const TOGGLE := "ui_toggle"
const AUDIO_AUTOLOAD := "Audio"

static func attach(button: BaseButton) -> void:
	button.pressed.connect(func() -> void: _play(CLICK))
	button.mouse_entered.connect(func() -> void:
		if not button.disabled:
			_play(HOVER))

## A picker's new choice (web sfx.play2D('ui_toggle') in MapPicker / TimePicker / ModeCarousel / Seats).
static func toggle() -> void:
	_play(TOGGLE)

## Any 2D sound event through the Audio autoload (the appearance previews: death, dash, shield_up …).
static func play(event: String) -> void:
	_play(event)

static func attach_picker(picker: OptionButton) -> void:
	picker.item_selected.connect(func(_index: int) -> void: _play(TOGGLE))

static func _play(event: String) -> void:
	var tree := Engine.get_main_loop() as SceneTree
	var audio := tree.root.get_node_or_null(AUDIO_AUTOLOAD) if tree != null else null
	if audio != null:
		audio.play_ui(event)
