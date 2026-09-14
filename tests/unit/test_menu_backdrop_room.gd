extends GutTest
## Menu backdrop room balls — web MenuBackdrop Scene: a ball per stage entry on its spot, new ones fading in on a warm
## stage, leaving ones shrinking out and removed after the exit time, the own ball keeping its instance.

const SCREEN := Vector2i(1280, 720)
const DT := 1.0 / 60.0
const EPS := 0.0001
const PINNED_TIME := 1.0
const PLAYER := {"color": "#ffaa44", "model": "smooth", "ring": "#44aaff", "art": ""}
const BOT := {"color": "#ffdd44", "model": "smooth", "ring": "#dd4444", "art": ""}

func _backdrop() -> MenuBackdrop:
	var viewport := SubViewport.new()
	viewport.size = SCREEN
	add_child_autofree(viewport)
	var backdrop := MenuBackdrop.new()
	viewport.add_child(backdrop)
	return backdrop

func _warm(backdrop: MenuBackdrop) -> void:
	for i in MenuStageBall.WARMUP_FRAMES + 2:
		backdrop._process(DT)

func test_seated_players_get_balls_and_leavers_shrink_out() -> void:
	var backdrop := _backdrop()
	_warm(backdrop)
	var own := backdrop.ball()
	backdrop.set_balls([
		{"key": MenuStage.PLAYER_KEY, "spec": PLAYER, "spot": MenuStage.STAGE_SPOTS[0]},
		{"key": "slot-1", "spec": BOT, "spot": MenuStage.STAGE_SPOTS[1]},
	])
	assert_eq(backdrop.ball(), own, "the own ball keeps its instance")
	var bot := backdrop.ball_for("slot-1")
	assert_not_null(bot)
	assert_true(bot.position.is_equal_approx(MenuStage.STAGE_SPOTS[1] + Vector3(0.0, SkinCurves.BODY_MESH_Y, 0.0)))
	backdrop._process(DT)
	assert_gt(backdrop.stage_for("slot-1").opacity, 0.0, "a ball joining a warm stage fades in at once")
	backdrop.set_balls([{"key": MenuStage.PLAYER_KEY, "spec": PLAYER, "spot": MenuStage.STAGE_SPOTS[0]}])
	for i in 30:
		backdrop._process(DT)
	assert_null(backdrop.ball_for("slot-1"), "gone after the exit time")

func test_a_pinned_shader_clock_holds_every_ball() -> void:
	var backdrop := _backdrop()
	backdrop.pin_ball_time(PINNED_TIME)
	for i in 3:
		backdrop._process(DT)
	assert_almost_eq(float(backdrop.ball().material().get_shader_parameter("time")), PINNED_TIME, EPS)
