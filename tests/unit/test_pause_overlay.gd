extends GutTest
## Pause menu parity with web PauseMenu: it shows while a live match has no pointer lock and never stops the match;
## MENU over RESUME (primary, waiting out the lock cooldown) and the ghost SETTINGS / TO MENU / QUIT; Esc and a lost
## window focus release the lock like the browser does.

const EPS := 0.01
const UNLOCK_AT_MS := 5000.0

class FakeLock extends PointerLock:
	var locked := true

	func is_locked() -> bool:
		return locked

	func lock() -> void:
		locked = true

	func release() -> void:
		locked = false

var _now := 0.0
var _live := true

func _overlay(lock: FakeLock) -> PauseOverlay:
	var overlay := PauseOverlay.new()
	overlay.setup(func() -> bool: return _live, lock, func() -> float: return _now)
	add_child_autofree(overlay)
	return overlay

func _button(overlay: PauseOverlay, node_name: String) -> UiButton:
	return overlay.find_child(node_name, true, false) as UiButton

func before_each() -> void:
	_now = 0.0
	_live = true

func test_shows_the_web_menu_without_the_lock() -> void:
	var lock := FakeLock.new()
	var overlay := _overlay(lock)
	overlay.refresh()
	assert_false(overlay.visible, "hidden while the pointer is locked")
	lock.release()
	overlay.refresh()
	assert_true(overlay.visible)
	var title := overlay.find_child("Title", true, false) as Label
	assert_eq(title.text, "MENU")
	assert_almost_eq(title.get_combined_minimum_size().y, 27.0, EPS, "h2 24 px line-height normal: 21 + 6")
	assert_almost_eq(title.get_theme_stylebox("normal").content_margin_right,
		float((title.get_theme_font("font") as FontVariation).spacing_glyph), EPS, "the trailing letter spacing")
	var expected := {"Resume": ["RESUME", UiButton.PRIMARY], "Settings": ["SETTINGS", UiButton.GHOST],
		"ToMenu": ["TO MENU", UiButton.GHOST], "Quit": ["QUIT", UiButton.GHOST]}
	for node_name in expected:
		var button := _button(overlay, node_name)
		assert_eq(button.text, expected[node_name][0])
		assert_eq(button.variant, expected[node_name][1])
	assert_false(get_tree().paused, "the match keeps running under the pause menu (web)")

func test_quit_only_on_the_desktop_build() -> void:
	var lock := FakeLock.new()
	lock.release()
	var overlay := _overlay(lock)
	overlay.set_quit_visible(false)
	overlay.refresh()
	assert_false(_button(overlay, "Quit").visible)

func test_no_pause_outside_the_live_phase() -> void:
	var lock := FakeLock.new()
	lock.release()
	_live = false
	var overlay := _overlay(lock)
	overlay.refresh()
	assert_false(overlay.visible, "countdown / match end")

func test_resume_waits_out_the_cooldown() -> void:
	var lock := FakeLock.new()
	var overlay := _overlay(lock)
	_now = UNLOCK_AT_MS
	overlay.refresh()
	lock.release()
	overlay.refresh()
	var resume := _button(overlay, "Resume")
	_now = UNLOCK_AT_MS + PauseModel.COOLDOWN_MS * 0.5
	overlay.refresh()
	assert_true(resume.disabled)
	assert_almost_eq(resume.opacity(), PauseOverlay.COOLDOWN_OPACITY, EPS)
	assert_not_null(resume.fade, "RESUME fades as one layer (CSS opacity)")
	assert_almost_eq((resume.get_theme_stylebox("disabled") as UiButton.CooldownStyle).share, 0.5, EPS)
	_now = UNLOCK_AT_MS + PauseModel.COOLDOWN_MS
	overlay.refresh()
	assert_false(resume.disabled)
	resume.pressed.emit()
	assert_true(lock.locked, "RESUME takes the pointer lock back")
	overlay.refresh()
	assert_false(overlay.visible)

func test_esc_and_focus_loss_release_the_lock() -> void:
	var lock := FakeLock.new()
	var overlay := _overlay(lock)
	var esc := InputEventAction.new()
	esc.action = "pause"
	esc.pressed = true
	overlay._unhandled_input(esc)
	assert_false(lock.locked, "Esc leaves the pointer lock")
	lock.lock()
	overlay._notification(Node.NOTIFICATION_APPLICATION_FOCUS_OUT)
	assert_false(lock.locked, "alt-tab loses it too")
