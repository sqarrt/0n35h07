extends GutTest
## Dash trail and shield skin nodes parity with web createDashFx / createShieldFx: the style picked from the roster,
## the meshes each style builds, emission while dashing and the animated shield parts.

const PLAYER := preload("res://scenes/player.tscn")
const STEP_S := 0.03

func _trail(style: String) -> DashTrailView:
	var trail := DashTrailView.new()
	add_child_autofree(trail)
	trail.setup(style, Color("#fa4"))
	return trail

func test_every_trail_style_emits_while_dashing() -> void:
	for style in [DashTrailView.STYLE_STREAK, DashTrailView.STYLE_WAVE, DashTrailView.STYLE_RIFT]:
		var trail := _trail(style)
		assert_eq(trail.style(), style)
		trail.update(STEP_S, true, Vector3.ZERO)
		trail.update(STEP_S, true, Vector3(0.7, 0, 0))
		assert_gt(trail.visible_count(), 0, "%s leaves a trail" % style)
	var rift := _trail(DashTrailView.STYLE_RIFT)
	rift.update(STEP_S, true, Vector3.ZERO)
	assert_eq(rift.visible_count(), RiftTrail.CHANNELS.size(), "one R / G / B triplet")

func test_shield_styles_build_their_parts() -> void:
	var shield := ShieldFx.new()
	add_child_autofree(shield)
	assert_eq(shield.style(), ShieldSkinState.DOME)
	shield.setup(ShieldSkinState.HEX)
	assert_eq(shield.tiles().size(), ShieldSkinState.HEX_TILES)
	shield.setup(ShieldSkinState.CRYSTAL)
	assert_eq(shield.faces().size(), ShieldSkinState.CRYSTAL_FACES)
	shield.show_dome(true)
	shield.update(STEP_S)
	assert_eq(shield.faces().filter(func(f): return f.visible).size(), 1, "one lit face at a time")

func test_player_takes_trail_and_shield_styles() -> void:
	var p: PlayerNode = PLAYER.instantiate()
	p.get_node("Camera3D").free()
	add_child_autofree(p)
	p.apply_appearance({"id": 1, "name": "EX82R", "kind": "bot", "color": "#fd4", "dashStyle": "wave",
		"shieldStyle": "crystal"})
	assert_eq(p.dash_trail().style(), DashTrailView.STYLE_WAVE)
	assert_eq(p.shield_fx().style(), ShieldSkinState.CRYSTAL)
	p.set_body_visible(false)
	p.update_visuals(STEP_S)
	assert_false(p.dash_trail().visible, "no own trail in first person")
