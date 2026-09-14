class_name RadioTransport extends RefCounted
## The radio host page's channel: text Godot sends into the page, and `received` for the text the page sends back
## (WebViewRadioTransport in the game, a fake in tests).

signal received(text: String)

func send(_text: String) -> void:
	pass
