class_name WebViewRadioTransport extends RadioTransport
## The radio host page in godot_wry's WebView (probes webview_audio_probe.gd, radio_host_probe.gd): a 1×1 box off
## screen — a hidden WebView throttles its timers to about one a second and Strudel would drop notes — with autoplay on
## (the AudioContext runs without a user gesture) and the page under res://localhost/: godot_wry serves it from
## http://res.localhost, a secure context, so the AudioWorklets load.

const CLASS_NAME := "WebView"
const PAGE := "res://localhost/radio_host/index.html"
const OFFSCREEN_BOX := Rect2(-10.0, -10.0, 1.0, 1.0)
const HEADLESS := "headless"

var _view: Control

## Whether this build can host the page: the extension is loaded and there is a real display.
static func available() -> bool:
	return ClassDB.class_exists(CLASS_NAME) and DisplayServer.get_name() != HEADLESS

## Create the WebView under `parent` and load the page; its messages come back through `received`.
func attach(parent: Node) -> void:
	_view = ClassDB.instantiate(CLASS_NAME) as Control
	_view.name = "RadioHostView"
	_view.set("autoplay", true)
	# godot_wry stretches a WebView over the whole window unless told not to: the blank page covered the game in white
	_view.set("full_window_size", false)
	_view.set("focused_when_created", false)   # the keyboard stays with the game
	_view.set("url", PAGE)
	_view.position = OFFSCREEN_BOX.position
	_view.size = OFFSCREEN_BOX.size
	_view.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_view.connect("ipc_message", func(text: String) -> void: received.emit(text))
	parent.add_child(_view)

func send(text: String) -> void:
	if _view != null:
		_view.call("post_message", text)
