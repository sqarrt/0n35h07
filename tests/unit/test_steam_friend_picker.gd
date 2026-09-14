extends GutTest
## "Choose a friend" (web components/lobby/SteamFriendPicker + theme.css .lobby-picker*): the centred 360 px card, the
## ONLINE · N count, only online friends listed and filtered by the search, the notes while the lobby forms or nobody is
## online, a row invites, and Esc / ✕ / the backdrop close.

const SCREEN := Vector2i(1280, 720)
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
	picker._unhandled_input(esc)
	assert_signal_emit_count(picker, "closed", 1)
	var click := InputEventMouseButton.new()
	click.pressed = true
	click.button_index = MOUSE_BUTTON_LEFT
	(picker.find_child("Backdrop", true, false) as ColorRect).gui_input.emit(click)
	(picker.find_child("Close", true, false) as Button).pressed.emit()
	assert_signal_emit_count(picker, "closed", 3, "the backdrop and ✕ close too")
