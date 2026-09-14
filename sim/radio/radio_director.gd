class_name RadioDirector
## web App's radio effects as pure decisions, applied by the Radio autoload: the menu music stops while the radio plays
## (radioActive), the trailer and a match stop the radio (web hard-stops a match that chose its own music; the in-match
## radio comes with slice R5), nothing reaches the engine before it is ready, and on a menu screen the profile's
## radioEnabled resumes it at the master × radio volume or truly pauses it (AudioContext.suspend).

const SCREEN_GAME := "game"
const SCREEN_TRAILER := "trailer"

## web: `if (radioActive) menuMusic.stop()`.
static func menu_music_allowed(enabled: bool, ready: bool) -> bool:
	return not (enabled and ready)

static func sync(host: RadioHost, ready: bool, enabled: bool, volume: float, screen: String) -> void:
	if screen == SCREEN_GAME or screen == SCREEN_TRAILER:
		host.stop()
		return
	if not ready:
		return
	if enabled:
		host.set_volume(volume)
		host.resume()
	else:
		host.pause()
