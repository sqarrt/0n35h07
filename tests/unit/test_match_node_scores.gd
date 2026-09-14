extends GutTest
## MatchNode participants: every Player for bot targeting and the per-player scores the HUD reads (web hud.scores).

const PLAYER := preload("res://scenes/player.tscn")

func _entity(root: Node, id: int) -> PlayerNode:
	var pnode: PlayerNode = PLAYER.instantiate()
	pnode.get_node("Camera3D").free()
	pnode.player.id = id
	root.add_child(pnode)
	return pnode

func test_players_and_scores_follow_the_entities() -> void:
	var root := Node3D.new()
	add_child_autofree(root)
	var match_node := MatchNode.new()
	root.add_child(match_node)
	var first := _entity(root, 0)
	var second := _entity(root, 3)
	match_node.add_entity(first, 0)
	match_node.add_entity(second, 1)
	second.player.kills = 2
	assert_eq(match_node.players().size(), 2)
	assert_true(second.player in match_node.players())
	assert_eq(match_node.scores(), [
		{"id": 0, "team": 0, "kills": 0, "deaths": 0},
		{"id": 3, "team": 1, "kills": 2, "deaths": 0},
	])
