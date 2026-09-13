extends GutTest
## HUD overlay effects parity with web WindupOverlay / RespawnOverlay / ScreenFlashes: vignettes follow state and
## tints flash for the web durations (useFlash: beam 200 ms, player hit 350 ms, shield block 250 ms) in web colours.

const SCREEN := Vector2i(1280, 720)
const MS_PER_S := 1000.0
const JUST_BEFORE := 0.9          # share of a flash duration
const JUST_AFTER := 1.1
const HALF := 0.5
const EPS := 0.001
const BYTE := 255.0

func _fx() -> HudOverlayFx:
	var screen := SubViewport.new()
	screen.size = SCREEN
	add_child_autofree(screen)
	var fx := HudOverlayFx.new()
	screen.add_child(fx)
	return fx

func _tint(fx: HudOverlayFx, node_name: String) -> ColorRect:
	return fx.find_child(node_name, true, false) as ColorRect

func _assert_rgba(actual: Color, r: float, g: float, b: float, a: float, what: String) -> void:
	assert_almost_eq(actual.r, r / BYTE, EPS, what + " r")
	assert_almost_eq(actual.g, g / BYTE, EPS, what + " g")
	assert_almost_eq(actual.b, b / BYTE, EPS, what + " b")
	assert_almost_eq(actual.a, a, EPS, what + " alpha")

func test_flash_durations_match_the_web() -> void:
	assert_eq(HudModel.BEAM_FLASH_MS, 200.0)
	assert_eq(HudModel.PLAYER_HIT_FLASH_MS, 350.0)
	assert_eq(HudModel.SHIELD_BLOCK_FLASH_MS, 250.0)

func test_tint_colours_match_the_web() -> void:
	_assert_rgba(HudModel.BEAM_TINT, 0, 255, 255, 0.04, "web rgba(0,255,255,0.04)")
	_assert_rgba(HudModel.PLAYER_HIT_TINT, 255, 0, 0, 0.08, "web rgba(255,0,0,0.08)")
	_assert_rgba(HudModel.SHIELD_BLOCK_TINT, 0, 180, 255, 0.07, "web rgba(0,180,255,0.07)")
	var fx := _fx()
	assert_eq(_tint(fx, "BeamTint").color, HudModel.BEAM_TINT)
	assert_eq(_tint(fx, "HitTint").color, HudModel.PLAYER_HIT_TINT)
	assert_eq(_tint(fx, "BlockTint").color, HudModel.SHIELD_BLOCK_TINT)

func test_hit_tint_shows_for_the_web_duration() -> void:
	var fx := _fx()
	assert_false(_tint(fx, "HitTint").visible, "no tint before a hit")
	fx.flash_hit()
	assert_true(_tint(fx, "HitTint").visible)
	fx.tick(HudModel.PLAYER_HIT_FLASH_MS / MS_PER_S * JUST_BEFORE)
	assert_true(_tint(fx, "HitTint").visible, "still on just before 350 ms")
	fx.tick(HudModel.PLAYER_HIT_FLASH_MS / MS_PER_S * (JUST_AFTER - JUST_BEFORE))
	assert_false(_tint(fx, "HitTint").visible, "off after 350 ms")

func test_beam_and_block_tints_use_their_own_durations() -> void:
	var fx := _fx()
	fx.flash_beam()
	fx.flash_block()
	fx.tick(HudModel.BEAM_FLASH_MS / MS_PER_S * JUST_AFTER)
	assert_false(_tint(fx, "BeamTint").visible, "beam flash is over after 200 ms")
	assert_true(_tint(fx, "BlockTint").visible, "block flash lasts 250 ms")

func test_windup_vignette_opacity_follows_the_charge() -> void:
	var fx := _fx()
	var vignette := fx.find_child("WindupVignette", true, false) as CanvasItem
	fx.set_windup(HALF)
	assert_true(vignette.visible)
	assert_almost_eq(vignette.modulate.a, HALF, EPS)
	fx.set_windup(0.0)
	assert_false(vignette.visible, "web renders nothing at zero charge")

func test_ghost_and_shield_vignettes_follow_state() -> void:
	var fx := _fx()
	var ghost := fx.find_child("GhostVignette", true, false) as CanvasItem
	var shield := fx.find_child("ShieldVignette", true, false) as CanvasItem
	fx.set_ghost(true)
	fx.set_shield_active(true)
	assert_true(ghost.visible)
	assert_true(shield.visible)
	fx.set_ghost(false)
	fx.set_shield_active(false)
	assert_false(ghost.visible)
	assert_false(shield.visible)
