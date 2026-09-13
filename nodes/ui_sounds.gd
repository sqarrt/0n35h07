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

static func attach_picker(picker: OptionButton) -> void:
	picker.item_selected.connect(func(_index: int) -> void: _play(TOGGLE))

static func _play(event: String) -> void:
	var tree := Engine.get_main_loop() as SceneTree
	var audio := tree.root.get_node_or_null(AUDIO_AUTOLOAD) if tree != null else null
	if audio != null:
		audio.play_ui(event)
