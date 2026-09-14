extends GutTest
## HUD parity with web GameOverlay → MatchHud: more than two players replace the duel bar with the team bar.

const PLAYER := preload("res://scenes/player.tscn")
const LockedPointer := preload("res://tests/support/locked_pointer.gd")
const SCREEN := Vector2i(1280, 720)
const TEAMS := [0, 0, 1, 1]

func test_four_players_get_the_team_bar() -> void:
	var screen := SubViewport.new()
	screen.size = SCREEN
	add_child_autofree(screen)
	var match_node := MatchNode.new()
	screen.add_child(match_node)
	var nodes: Array[PlayerNode] = []
	for id in TEAMS.size():
		var pnode: PlayerNode = PLAYER.instantiate()
		pnode.get_node("Camera3D").free()
		pnode.player.id = id
		screen.add_child(pnode)
		match_node.roster.add({"id": id, "name": "P%d" % id, "color": "#ffaa44", "kind": "bot"})
		match_node.add_entity(pnode, TEAMS[id])
		nodes.append(pnode)
	var hud := Hud.new()
	screen.add_child(hud)
	hud.setup(nodes[0], match_node, LockedPointer.new())
	match_node.force_live()
	hud._process(0.0)
	var team_bar := hud.find_child("TeamBar", true, false) as HudTeamBar
	assert_not_null(team_bar, "web MatchHud: roster.length > 2")
	assert_true(team_bar.visible)
	assert_false((hud.find_child("TopBar", true, false) as Control).visible, "the duel bar steps aside")
	assert_eq(team_bar.rows().size(), 4)
