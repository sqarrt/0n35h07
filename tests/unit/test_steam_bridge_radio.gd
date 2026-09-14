extends GutTest
## The Steam bridge's Radio DLC calls (web steam.ts radioDlcOwned / openRadioStore / onRadioRecheckDlc): ownership
## of the DLC app, its store page as a steam:// URL for the Steam client, and a recheck when the overlay closes.

const BRIDGE := preload("res://autoloads/steam_bridge.gd")
const FAKE := preload("res://tests/unit/fake_steam_api.gd")

var _opened: Array = []

func before_each() -> void:
	_opened = []

func _bridge(up := true) -> Array:
	var fake = FAKE.new()
	fake.up = up
	var bridge = BRIDGE.new()
	bridge.api = fake
	bridge.open_url = func(url: String) -> void: _opened.append(url)
	add_child_autofree(bridge)
	return [bridge, fake]

func test_the_dlc_is_owned_when_steam_says_so() -> void:
	var made := _bridge()
	var bridge = made[0]
	assert_false(bridge.radio_dlc_owned())
	made[1].owned_apps = [BRIDGE.RADIO_DLC_APP_ID]
	assert_true(bridge.radio_dlc_owned())

func test_the_store_page_opens_in_the_steam_client() -> void:
	var bridge = _bridge(false)[0]
	bridge.open_radio_store()
	assert_eq(_opened, ["steam://store/4904970"], "web: works without the SDK up")

func test_closing_the_overlay_asks_for_a_recheck() -> void:
	var made := _bridge()
	var bridge = made[0]
	watch_signals(bridge)
	made[1].overlay_toggled.emit(true)
	assert_signal_not_emitted(bridge, "overlay_closed", "opening it is not a purchase")
	made[1].overlay_toggled.emit(false)
	assert_signal_emitted(bridge, "overlay_closed")
