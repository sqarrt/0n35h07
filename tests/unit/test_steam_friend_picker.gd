extends GutTest
## "Choose a friend" (web components/lobby/SteamFriendPicker + theme.css .lobby-picker*): the centred 360 px card, the
## ONLINE · N count, only online friends listed and filtered by the search, the notes while the lobby forms or nobody is
## online, a row invites, and Esc / ✕ / the backdrop close.

const SCREEN := Vector2i(1280, 720)
const CARD_HEIGHT := 364.0      # web frame: .lobby-picker [460, 178, 360, 364]
const CLOSE_HEIGHT := 20.0      # web frame: .lobby-picker-x 21.08 × 20
const EPS := 0.6
const FRIENDS := [
	{"id": "11", "name": "alice", "online": true},
	{"id": "22", "name": "Bob", "online": true},
	{"id": "33", "name": "zed", "online": false},
]

func _picker(friends: Array = FRIENDS) -> SteamFriendPicker:
	var viewport := SubViewport.new()
	viewport.size = SCREEN
	add_child_autofree(viewport)
	var picker := SteamFriendPicker.new()
	picker.friends_source = func() -> Array: return friends
	viewport.add_child(picker)
	await wait_process_frames(2)
	return picker

func _rows(picker: SteamFriendPicker) -> Array:
	return picker.find_children("Friend_*", "", true, false)

func test_online_friends_and_their_count() -> void:
	var picker := await _picker()
	assert_eq((picker.find_child("Count", true, false) as Label).text, "ONLINE · 2")
	assert_eq(_rows(picker).map(func(row: Node) -> String: return row.name), ["Friend_11", "Friend_22"],
		"offline friends are not listed")
	var card := picker.find_child("Card", true, false) as Control
	assert_eq(card.size.x, SteamFriendPicker.CARD_MAX_WIDTH)
	assert_eq(card.position.x, (SCREEN.x - SteamFriendPicker.CARD_MAX_WIDTH) * 0.5, "centred")
	assert_eq(card.size.y, CARD_HEIGHT, "web .lobby-picker 364 px")
	assert_almost_eq((picker.find_child("Close", true, false) as Control).size.y, CLOSE_HEIGHT, EPS,
		"✕ 16px, line-height 1, padding 2px 4px")
	var shadow := (picker.find_child("CardShadow", true, false) as ColorRect).material as ShaderMaterial
	assert_eq(shadow.get_shader_parameter("box_px"), card.size, "0 24px 70px -16px under the card")
	assert_eq(shadow.get_shader_parameter("shadow_sigma"), SteamFriendPicker.CARD_SHADOW_BLUR * 0.5)
	var blur := (picker.find_child("BackdropBlur", true, false) as ColorRect).material as ShaderMaterial
	assert_eq(blur.get_shader_parameter("sigma"), SteamFriendPicker.BACKDROP_BLUR_PX, "backdrop-filter: blur(2px)")
	await wait_process_frames(1)
	assert_true((picker.find_child("Search", true, false) as LineEdit).has_focus(), "web autoFocus")

func test_the_search_filters_by_name() -> void:
	var picker := await _picker()
	var search := picker.find_child("Search", true, false) as LineEdit
	search.text = "BO"
	search.text_changed.emit(search.text)
	assert_eq(_rows(picker).size(), 1)
	assert_eq(picker.shown()[0]["name"], "Bob", "case-insensitive")

func test_notes_instead_of_the_list() -> void:
	var picker := await _picker([])
	assert_eq((picker.find_child("Note", true, false) as Label).text, "NO FRIENDS ONLINE")
	picker.set_forming(true)
	assert_eq((picker.find_child("Note", true, false) as Label).text, "PREPARING LOBBY…")

func test_a_row_invites_and_esc_closes() -> void:
	var picker := await _picker()
	watch_signals(picker)
	(_rows(picker)[1] as Button).pressed.emit()
	assert_signal_emitted_with_parameters(picker, "picked", ["22", "Bob"])
	var esc := InputEventKey.new()
	esc.pressed = true
	esc.keycode = KEY_ESCAPE
	picker._input(esc)
	assert_signal_emit_count(picker, "closed", 1)
	var click := InputEventMouseButton.new()
	click.pressed = true
	click.button_index = MOUSE_BUTTON_LEFT
	(picker.find_child("Backdrop", true, false) as ColorRect).gui_input.emit(click)
	(picker.find_child("Close", true, false) as BaseButton).pressed.emit()
	assert_signal_emit_count(picker, "closed", 3, "the backdrop and ✕ close too")
