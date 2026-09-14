extends GutTest
## A bot's target — web Match.nearestEnemy: the nearest living player of another team.

class FakeBody:
	var position := Vector3.ZERO

class FakePlayer:
	var id := 0
	var team := 0
	var alive := true
	var body := FakeBody.new()

	func _init(player_id: int, player_team: int, at: Vector3) -> void:
		id = player_id
		team = player_team
		body.position = at

func test_the_nearest_living_enemy() -> void:
	var me := FakePlayer.new(0, 0, Vector3.ZERO)
	var mate := FakePlayer.new(1, 0, Vector3(1, 0, 0))
	var far_enemy := FakePlayer.new(2, 1, Vector3(9, 0, 0))
	var near_enemy := FakePlayer.new(3, 2, Vector3(4, 0, 0))
	var players := [me, mate, far_enemy, near_enemy]
	assert_eq(NearestEnemy.of(me, players), near_enemy, "teammates are skipped, the closer enemy wins")
	near_enemy.alive = false
	assert_eq(NearestEnemy.of(me, players), far_enemy, "the dead are skipped")
	far_enemy.alive = false
	assert_null(NearestEnemy.of(me, players), "nobody hostile is up")
