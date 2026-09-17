extends GutTest
## Beam skin nodes parity with web ClassicBeamFx / RageBeamFx / SingularityBeamFx and Match's beam choice
## (humans: their windup style in their colour; bots: classic with a red shell).

const PLAYER := preload("res://scenes/player.tscn")
const EPS := 0.001
const DT := 1.0 / 60.0
const START := Vector3(0, 1, 0)
const END := Vector3(0, 1, -10)
const QUARTER_S := CombatConst.BEAM_DURATION_MS / 4.0 / SkinCurves.MS_PER_S

func _fx(style: String) -> BeamFx:
	var fx := BeamFx.new()
	add_child_autofree(fx)
	fx.setup(style, Color("#fa4"))
	return fx

func test_classic_shrinks_then_leaves_an_afterglow() -> void:
	var fx := _fx(BeamFx.STYLE_CLASSIC)
	fx.play(START, END)
	fx.update_fx(QUARTER_S)
	assert_true(fx.is_beam_visible())
	assert_almost_eq(fx.core().global_transform.basis.x.length(), 0.75, EPS, "radial scale 1 - t")
	assert_almost_eq(fx.core().global_transform.basis.y.length(), 10.0, EPS, "length along the beam")
	for i in 12:
		fx.update_fx(DT)
	assert_false(fx.is_beam_visible(), "gone after 200 ms")
	assert_true(fx.afterglow_visible(), "the afterglow outlives the beam")
	for i in 20:
		fx.update_fx(DT)
	assert_false(fx.afterglow_visible(), "energy 0.5 fades at 1.8 per second")

func test_rage_has_seven_segments_and_steps_its_fade() -> void:
	var fx := _fx(BeamFx.STYLE_RAGE)
	assert_eq(fx.segments().size(), BeamCurves.RAGE_SEGMENTS)
	fx.play(START, END)
	fx.update_fx(CombatConst.BEAM_DURATION_MS * 0.5 / SkinCurves.MS_PER_S)
	var core_alpha := (fx.core().material_override as StandardMaterial3D).albedo_color.a
	assert_almost_eq(core_alpha, 0.35, EPS, "the 45-60% dropout step")

func test_singularity_spiral_retracts_into_the_muzzle() -> void:
	var fx := _fx(BeamFx.STYLE_SINGULARITY)
	fx.play(START, END)
	fx.update_fx(CombatConst.BEAM_DURATION_MS * 0.675 / SkinCurves.MS_PER_S)
	assert_true(fx.spiral().visible)
	assert_eq(fx.spiral().multimesh.instance_count, BeamCurves.SING_SPIRAL_PARTICLES)
	assert_almost_eq(fx.core().global_transform.basis.y.length(), 5.0, EPS, "half retracted at t = 0.675")

func test_players_pick_the_web_beam() -> void:
	var bot: PlayerNode = PLAYER.instantiate()
	bot.get_node("Camera3D").free()
	add_child_autofree(bot)
	bot.apply_appearance({"id": 1, "name": "EX82R", "kind": "bot", "color": "#fd4", "windupStyle": "singularity"})
	var bot_fx := bot.find_child("BeamFx", true, false) as BeamFx
	assert_eq(bot_fx.style(), BeamFx.STYLE_CLASSIC, "bots always fire the classic beam")
	var human: PlayerNode = PLAYER.instantiate()
	human.get_node("Camera3D").free()
	add_child_autofree(human)
	human.apply_appearance({"id": 0, "name": "PARITY7", "kind": "human", "color": "#fa4", "windupStyle": "rage"})
	assert_eq((human.find_child("BeamFx", true, false) as BeamFx).style(), BeamFx.STYLE_RAGE)
