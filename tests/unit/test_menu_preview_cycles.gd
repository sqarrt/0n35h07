extends GutTest
## Appearance style previews as timelines of the time since the click — web MenuBackdrop StageBall cycles: SHOT charges
## for the windup then deflates, RESPAWN runs the ghost once around the circle then reassembles, DASH goes out, pauses
## and comes back, SHIELD holds its skin; before a click and after the end every cycle idles.

const EPS := 0.0001

func test_shot_charges_then_deflates() -> void:
	assert_eq(MenuPreviewCycles.shot(INF)["phase"], MenuPreviewCycles.IDLE)
	var charge := MenuPreviewCycles.shot(MenuPreviewCycles.CHARGE_MS * 0.5)
	assert_eq(charge["phase"], MenuPreviewCycles.CHARGE)
	assert_almost_eq(charge["progress"], 0.5, EPS)
	assert_eq(charge["shrink"], 1.0)
	var fire := MenuPreviewCycles.shot(MenuPreviewCycles.CHARGE_MS + MenuPreviewCycles.FIRE_MS * 0.25)
	assert_eq(fire["phase"], MenuPreviewCycles.FIRE)
	assert_eq(fire["progress"], 0.0)
	assert_almost_eq(fire["shrink"], 0.25, EPS)
	assert_eq(MenuPreviewCycles.shot(MenuPreviewCycles.CHARGE_MS + MenuPreviewCycles.FIRE_MS)["phase"], MenuPreviewCycles.IDLE)

func test_respawn_runs_the_circle_then_reassembles() -> void:
	var half := MenuPreviewCycles.respawn(MenuPreviewCycles.GHOST_MS * 0.5)
	assert_eq(half["phase"], MenuPreviewCycles.GHOST)
	assert_almost_eq(half["ghost_left"], 0.5, EPS)
	assert_almost_eq(half["theta"], PI, EPS)
	assert_true(MenuPreviewCycles.ghost_offset(PI).is_equal_approx(Vector3(0.0, 0.0, -2.0 * MenuPreviewCycles.CIRCLE_R)),
		"halfway round: the far side of the circle")
	assert_true(MenuPreviewCycles.ghost_offset(0.0).is_zero_approx(), "the run starts on the spot")
	var rebirth := MenuPreviewCycles.respawn(MenuPreviewCycles.GHOST_MS + 100.0)
	assert_eq(rebirth["phase"], MenuPreviewCycles.REBIRTH)
	assert_almost_eq(rebirth["since_rebirth_ms"], 100.0, EPS)
	assert_eq(MenuPreviewCycles.respawn(MenuPreviewCycles.GHOST_MS + MenuPreviewCycles.REBIRTH_MS)["phase"],
		MenuPreviewCycles.IDLE)

func test_dash_goes_out_pauses_and_returns() -> void:
	var distance := MenuPreviewCycles.dash_distance()
	assert_almost_eq(distance, 3.6, EPS, "24 m/s for 150 ms")
	var out := MenuPreviewCycles.dash(MenuPreviewCycles.DASH_MS * 0.5)
	assert_eq(out["phase"], MenuPreviewCycles.OUT)
	assert_almost_eq(out["offset"], distance * 0.5, EPS)
	var pause := MenuPreviewCycles.dash(MenuPreviewCycles.DASH_MS + 10.0)
	assert_eq(pause["phase"], MenuPreviewCycles.PAUSE)
	assert_almost_eq(pause["offset"], distance, EPS)
	var back := MenuPreviewCycles.dash(MenuPreviewCycles.DASH_MS * 1.5 + MenuPreviewCycles.DASH_PAUSE_MS)
	assert_eq(back["phase"], MenuPreviewCycles.BACK)
	assert_almost_eq(back["offset"], distance * 0.5, EPS)
	assert_eq(MenuPreviewCycles.dash(MenuPreviewCycles.DASH_MS * 2.0 + MenuPreviewCycles.DASH_PAUSE_MS)["offset"], 0.0)

func test_shield_holds_its_skin() -> void:
	assert_false(MenuPreviewCycles.shield_active(INF))
	assert_true(MenuPreviewCycles.shield_active(0.0))
	assert_true(MenuPreviewCycles.shield_active(MenuPreviewCycles.SHIELD_MS - 1.0))
	assert_false(MenuPreviewCycles.shield_active(MenuPreviewCycles.SHIELD_MS))
