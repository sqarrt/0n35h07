extends GutTest
## The menu edge glow's brightness — web MenuEdgeGlow useFrame: nothing until the composer mounts (600 ms), then the
## audio level on a perceptual √ curve (gain 3.2, capped at 1) smoothed by 0.18 per frame, times 1.1; muted → 0.

const EPS := 0.0001
const DT := 1.0 / 60.0
const SETTLE_FRAMES := 120

func _mounted() -> MenuGlowLevel:
	var glow := MenuGlowLevel.new()
	glow.step(MenuGlowLevel.MOUNT_DELAY_MS / MenuGlowLevel.MS_PER_S, 1.0, false)
	return glow

func test_dark_until_the_composer_mounts() -> void:
	var glow := MenuGlowLevel.new()
	for i in 30:
		glow.step(DT, 1.0, false)
	assert_almost_eq(glow.intensity(), 0.0, EPS, "half a second in: not mounted yet")
	assert_false(glow.is_lit())

func test_first_frame_smooths_toward_the_level() -> void:
	var glow := _mounted()
	glow.step(DT, 0.1, false)
	var target := sqrt(0.1 * MenuGlowLevel.LEVEL_GAIN)
	assert_almost_eq(glow.intensity(), target * MenuGlowLevel.GLOW_SMOOTH * MenuGlowLevel.INTENSITY_GAIN, EPS)
	assert_true(glow.is_lit())

func test_settles_on_the_curve_and_caps() -> void:
	var glow := _mounted()
	for i in SETTLE_FRAMES:
		glow.step(DT, 0.1, false)
	assert_almost_eq(glow.intensity(), sqrt(0.1 * MenuGlowLevel.LEVEL_GAIN) * MenuGlowLevel.INTENSITY_GAIN, EPS)
	for i in SETTLE_FRAMES:
		glow.step(DT, 1.0, false)
	assert_almost_eq(glow.intensity(), MenuGlowLevel.INTENSITY_GAIN, EPS, "√3.2 capped at 1")

func test_muted_fades_out() -> void:
	var glow := _mounted()
	for i in SETTLE_FRAMES:
		glow.step(DT, 1.0, false)
	for i in SETTLE_FRAMES:
		glow.step(DT, 1.0, true)
	assert_false(glow.is_lit(), "the menuGlow setting off")
