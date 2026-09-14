extends GutTest
## RadioDirector — web App's radio effects as pure decisions: the menu music stops while the radio plays (radioActive),
## the trailer and a match stop the radio, nothing reaches the engine before it is ready, and on a menu screen the
## profile's radioEnabled resumes it at the master × radio volume or pauses it.

const VOLUME := 0.36
const MENU := "menu"

class FakeTransport extends RadioTransport:
	var sent: Array[String] = []

	func send(text: String) -> void:
		sent.append(text)

	func deliver(text: String) -> void:
		received.emit(text)

## [host, transport], the page already loaded so commands go straight through.
func _host() -> Array:
	var transport := FakeTransport.new()
	var host := RadioHost.new(transport)
	transport.deliver('{"event":"ready"}')
	return [host, transport]

func test_the_menu_music_waits_while_the_radio_plays() -> void:
	assert_true(RadioDirector.menu_music_allowed(false, true), "switched off")
	assert_true(RadioDirector.menu_music_allowed(true, false), "on, but the engine is still warming up")
	assert_false(RadioDirector.menu_music_allowed(true, true), "web radioActive → menuMusic.stop()")

func test_a_menu_screen_resumes_or_pauses_by_the_profile() -> void:
	var parts := _host()
	var transport: FakeTransport = parts[1]
	RadioDirector.sync(parts[0], true, true, VOLUME, MENU)
	assert_eq(transport.sent, [RadioProtocol.volume_command(VOLUME), RadioProtocol.command(RadioProtocol.RESUME)])
	transport.sent.clear()
	RadioDirector.sync(parts[0], true, false, VOLUME, MENU)
	assert_eq(transport.sent, [RadioProtocol.command(RadioProtocol.PAUSE)], "a true pause (AudioContext.suspend)")

func test_nothing_before_the_engine_is_ready() -> void:
	var parts := _host()
	RadioDirector.sync(parts[0], false, true, VOLUME, MENU)
	assert_eq((parts[1] as FakeTransport).sent, [])

func test_the_trailer_and_a_match_stop_the_radio() -> void:
	for screen in [RadioDirector.SCREEN_TRAILER, RadioDirector.SCREEN_GAME]:
		var parts := _host()
		RadioDirector.sync(parts[0], true, true, VOLUME, screen)
		assert_eq((parts[1] as FakeTransport).sent, [RadioProtocol.command(RadioProtocol.STOP)], screen)
