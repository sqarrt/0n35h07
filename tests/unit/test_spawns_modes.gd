extends GutTest
## Start positions per mode — web game/spawns.ts: 2v2 clusters around the two map points, FFA points in seat order
## (falling back to the map points), the 1v1 rule, and the random FFA points kept apart inside the arena square.

const EPS := 0.001
const POINT_A := Vector3(0.0, 1.0, 10.0)
const POINT_B := Vector3(0.0, 1.0, -10.0)
const MAP := [POINT_A, POINT_B]

func test_battle_clusters_each_team_around_its_point() -> void:
	var out := Spawns.positions_for_mode(GameModes.BATTLE, [0, 1, 2, 3], MAP)
	assert_eq(out[0], POINT_A + Vector3(-0.9, 0.0, 0.0), "team 0, first member")
	assert_eq(out[1], POINT_A + Vector3(0.9, 0.0, 0.0), "team 0, second member")
	assert_eq(out[2], POINT_B + Vector3(-0.9, 0.0, 0.0), "team 1, first member")
	assert_eq(out[3], POINT_B + Vector3(0.9, 0.0, 0.0))

func test_war_takes_the_shipped_points_in_seat_order() -> void:
	var ffa := [Vector3(1, 1, 1), Vector3(2, 1, 2)]
	var out := Spawns.positions_for_mode(GameModes.WAR, [0, 2, 3], MAP, ffa)
	assert_eq(out[0], ffa[0])
	assert_eq(out[2], ffa[1])
	assert_eq(out[3], POINT_A, "past the shipped points: map point i % 2")

func test_duel_and_war_without_points_use_the_pair_rule() -> void:
	var out := Spawns.positions_for_mode(GameModes.DUEL, [0, 1], MAP)
	assert_eq(out[0], POINT_A)
	assert_eq(out[1], POINT_B)
	assert_eq(Spawns.positions_for_mode(GameModes.WAR, [0, 3], MAP)[3], POINT_B, "no shipped points: slot 0 → A, others → B")

func test_ffa_points_stay_inside_and_apart() -> void:
	var rng := RandomNumberGenerator.new()
	rng.seed = 7
	var points := Spawns.gen_ffa_spawns(4, 1.5, rng.randf)
	assert_eq(points.size(), 4)
	for i in points.size():
		var p: Vector3 = points[i]
		assert_almost_eq(p.y, 1.5, EPS)
		assert_true(absf(p.x) <= Spawns.FFA_HALF and absf(p.z) <= Spawns.FFA_HALF, "inside the arena square")
		for j in range(i + 1, points.size()):
			var q: Vector3 = points[j]
			assert_true(Vector2(p.x - q.x, p.z - q.z).length() >= Spawns.FFA_MIN_DIST, "at least 6 apart")

func test_the_first_point_is_the_first_try() -> void:
	var rolls := [0.75, 0.25]
	var i := [0]
	var rng := func() -> float:
		var value: float = rolls[i[0] % rolls.size()]
		i[0] += 1
		return value
	var points := Spawns.gen_ffa_spawns(1, 0.0, rng)
	assert_eq(points[0], Vector3(7.0, 0.0, -7.0), "(r * 2 - 1) * 14 on x then z")
