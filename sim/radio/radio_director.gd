class_name RadioDirector
## web App's radio effects as pure decisions, applied by the Radio autoload: the menu music stops while the radio plays
## (radioActive); the trailer always stops the radio, and so does a match that chose its own music — one started while
## the radio was not playing (web gameNet.radioForMatch) — while a match started with the radio on keeps it as the
## soundtrack; nothing reaches the engine before it is ready, and otherwise the profile's radioEnabled resumes it at the
## master × radio volume or truly pauses it (AudioContext.suspend).

const SCREEN_GAME := "game"
const SCREEN_TRAILER := "trailer"

## web: `if (radioActive) menuMusic.stop()`.
static func menu_music_allowed(enabled: bool, ready: bool) -> bool:
	return not (enabled and ready)

## `radio_for_match`: the radio was the soundtrack when the match on `screen` started.
static func sync(host: RadioHost, ready: bool, enabled: bool, volume: float, screen: String, radio_for_match := false) -> void:
	if screen == SCREEN_TRAILER or (screen == SCREEN_GAME and not radio_for_match):
		host.stop()
		return
	if not ready:
		return
	if enabled:
		host.set_volume(volume)
		host.resume()
	else:
		host.pause()
