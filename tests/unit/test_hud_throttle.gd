extends GutTest
## HUD update pacing parity with web Match.syncHud (50 ms throttle) and the CSS transitions of the windup vignette
## (opacity 70 ms linear) and the ghost-phase bars (width 50 ms linear).

const EPS := 0.001
const FRAME_MS := 1000.0 / 60.0

func test_throttle_pushes_at_once_then_after_more_than_50_ms() -> void:
	var throttle := HudThrottle.new()
	assert_true(throttle.tick(FRAME_MS), "the first frame pushes")
	assert_false(throttle.tick(FRAME_MS))
	assert_false(throttle.tick(FRAME_MS))
	assert_false(throttle.tick(FRAME_MS), "exactly 50 ms is not more than 50")
	assert_true(throttle.tick(FRAME_MS), "the fourth frame after a push (66.7 ms) pushes")

func test_windup_vignette_fades_between_throttled_values() -> void:
	var screen := SubViewport.new()
	screen.size = Vector2i(1280, 720)
	add_child_autofree(screen)
	var fx := HudOverlayFx.new()
	screen.add_child(fx)
	var vignette := fx.find_child("WindupVignette", true, false) as CanvasItem
	fx.set_windup(0.2)
	assert_almost_eq(vignette.modulate.a, 0.2, EPS, "mounts at the current charge")
	fx.set_windup(0.6)
	fx.tick(0.035)
	assert_almost_eq(vignette.modulate.a, 0.4, EPS, "glides over 70 ms")
	fx.set_windup(0.0)
	assert_false(vignette.visible, "gone at once when the windup ends")

func test_transition_moves_linearly_and_restarts_from_the_current_value() -> void:
	var fade := CssTransition.new(0.07)
	fade.set_target(1.0)
	fade.advance(0.035)
	assert_almost_eq(fade.value, 0.5, EPS)
	fade.set_target(0.0)
	fade.advance(0.035)
	assert_almost_eq(fade.value, 0.25, EPS, "restarts from 0.5 towards 0 over a fresh 70 ms")
	fade.set_target(0.0)
	fade.advance(0.035)
	assert_almost_eq(fade.value, 0.0, EPS, "the same target doesn't restart")
	fade.snap(0.8)
	assert_almost_eq(fade.value, 0.8, EPS)
