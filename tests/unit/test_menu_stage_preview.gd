extends GutTest
## Appearance style previews on the backdrop ball — web MenuBackdrop StageBall: a dash click carries the ball out along +X
## and back, a respawn click runs the ghost around the circle, a shield click shows the skin for its time, a shot click
## fires the beam after the charge, and a pinned hold freezes the preview clock.

const SCREEN := Vector2i(1280, 720)
const DT := 1.0 / 60.0
const EPS := 0.01
const SPEC := {"color": "#ffaa44", "model": "smooth", "ring": "#44aaff", "art": "", "windup": "classic",
	"respawn": "echo", "dash": "streak", "shield": "dome"}

func _backdrop() -> MenuBackdrop:
	var viewport := SubViewport.new()
	viewport.size = SCREEN
	add_child_autofree(viewport)
	var backdrop := MenuBackdrop.new()
	viewport.add_child(backdrop)
	backdrop.set_screen(MenuCameraRig.SCREEN_APPEARANCE)
	backdrop.set_balls([{"key": MenuStage.PLAYER_KEY, "spec": SPEC, "spot": MenuStage.STAGE_SPOTS[0]}])
	for i in MenuStageBall.WARMUP_FRAMES + 2:
		backdrop._process(DT)
	return backdrop

func _run(backdrop: MenuBackdrop, ms: float) -> void:
	for i in roundi(ms / (DT * 1000.0)):
		backdrop._process(DT)

func _home() -> Vector3:
	return MenuStage.STAGE_SPOTS[0] + MenuStagePreview.MESH_OFFSET

func test_the_preview_lives_only_on_the_appearance_screen() -> void:
	var backdrop := _backdrop()
	assert_not_null(backdrop.preview())
	assert_true(backdrop.glow().is_lit(), "the web composer blooms the previews' bright effects even in silence")
	backdrop.set_screen(MenuCameraRig.SCREEN_MENU)
	assert_null(backdrop.preview())

func test_dash_goes_out_and_comes_back() -> void:
	var backdrop := _backdrop()
	backdrop.preview_style(MenuCameraRig.PART_DASH, "streak")
	_run(backdrop, MenuPreviewCycles.DASH_MS + 100.0)
	assert_almost_eq(backdrop.ball().position.x, _home().x + MenuPreviewCycles.dash_distance(), EPS, "paused out")
	_run(backdrop, MenuPreviewCycles.DASH_PAUSE_MS + MenuPreviewCycles.DASH_MS + 100.0)
	assert_true(backdrop.ball().position.is_equal_approx(_home()), "back on the spot")

func test_respawn_runs_the_ghost_round() -> void:
	var backdrop := _backdrop()
	backdrop.preview_style(MenuCameraRig.PART_RESPAWN, "echo")
	_run(backdrop, MenuPreviewCycles.GHOST_MS * 0.5)
	assert_almost_eq(backdrop.ball().position.z, _home().z - 2.0 * MenuPreviewCycles.CIRCLE_R, 0.2, "the far side")

func test_shield_shows_for_its_time() -> void:
	var backdrop := _backdrop()
	backdrop.preview_style(MenuCameraRig.PART_SHIELD, "dome")
	_run(backdrop, 100.0)
	assert_true(backdrop.preview().shield().is_dome_visible())
	_run(backdrop, MenuPreviewCycles.SHIELD_MS)
	assert_false(backdrop.preview().shield().is_dome_visible())

func test_shot_fires_after_the_charge() -> void:
	var backdrop := _backdrop()
	backdrop.preview_style(MenuCameraRig.PART_SHOT, "classic")
	_run(backdrop, MenuPreviewCycles.CHARGE_MS * 0.5)
	assert_false(backdrop.preview().beam().is_beam_visible())
	_run(backdrop, MenuPreviewCycles.CHARGE_MS * 0.5 + 50.0)
	assert_true(backdrop.preview().beam().is_beam_visible())

func test_a_hold_freezes_the_preview() -> void:
	var backdrop := _backdrop()
	backdrop.pin_preview_hold_ms(MenuPreviewCycles.DASH_MS * 0.5)
	backdrop.preview_style(MenuCameraRig.PART_DASH, "streak")
	_run(backdrop, 1000.0)
	assert_almost_eq(backdrop.ball().position.x, _home().x + MenuPreviewCycles.dash_distance() * 0.5, EPS,
		"stopped halfway out")
