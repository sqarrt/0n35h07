extends GutTest
## RadioSoftBloom — web MenuEdgeGlow's softBloom morph: nothing before the composer mounts, the one bloom easing to
## threshold 0 / radius 0.95 at a 0.35 base in silence, its intensity rising with the level, back to the menu's bloom
## when the Radio screen closes, the edges 1.8× while it is up.

const EPS := 0.001
const FRAME_S := 1.0 / 60.0
const SETTLE_FRAMES := 120

func _mounted() -> RadioSoftBloom:
	var soft := RadioSoftBloom.new()
	soft.step(MenuGlowLevel.MOUNT_DELAY_MS / RadioSoftBloom.MS_PER_S, 0.0, false)
	return soft

func _run(soft: RadioSoftBloom, level: float, on: bool, frames: int) -> void:
	for i in frames:
		soft.step(FRAME_S, level, on)

func test_nothing_before_the_composer_mounts() -> void:
	var soft := RadioSoftBloom.new()
	soft.step(FRAME_S, 1.0, true)
	assert_eq(soft.fade(), 0.0)
	assert_false(soft.is_visible())
	assert_almost_eq(soft.threshold(), MenuEdgeGlow.BLOOM_THRESHOLD, EPS, "the menu's bloom")

func test_the_radio_screen_morphs_the_bloom_to_frosted_glass() -> void:
	var soft := _mounted()
	_run(soft, 0.0, true, SETTLE_FRAMES)
	assert_almost_eq(soft.fade(), 1.0, EPS)
	assert_almost_eq(soft.threshold(), RadioSoftBloom.THRESHOLD, EPS)
	assert_almost_eq(soft.radius(), RadioSoftBloom.RADIUS, EPS)
	assert_almost_eq(soft.intensity(), RadioSoftBloom.BASE, EPS, "hazy even in silence")
	assert_true(soft.is_visible())

func test_the_fade_eases_over_a_fifth_of_a_second() -> void:
	var soft := _mounted()
	soft.step(RadioSoftBloom.FADE_TAU, 0.0, true)
	assert_almost_eq(soft.fade(), 1.0 - exp(-1.0), EPS, "one tau: 63%")

func test_the_level_lifts_the_frosted_intensity() -> void:
	var soft := _mounted()
	_run(soft, 0.25, true, SETTLE_FRAMES)
	assert_almost_eq(soft.intensity(), RadioSoftBloom.BASE + RadioSoftBloom.GAIN * sqrt(0.25 * RadioSoftBloom.LEVEL_GAIN),
		EPS)

func test_closing_the_radio_brings_the_menus_bloom_back() -> void:
	var soft := _mounted()
	_run(soft, 0.0, true, SETTLE_FRAMES)
	_run(soft, 0.0, false, SETTLE_FRAMES)
	assert_almost_eq(soft.intensity(), MenuEdgeGlow.BLOOM_INTENSITY, EPS)
	assert_almost_eq(soft.radius(), MenuEdgeGlow.BLOOM_RADIUS, EPS)

func test_edges_are_brighter_on_the_radio_screen() -> void:
	assert_eq(RadioSoftBloom.edge_boost(true), 1.8)
	assert_eq(RadioSoftBloom.edge_boost(false), 1.0)
