extends GutTest
## 1v1 spawn rule ported from web spawnPositionsFor: slot 0 -> map point 0, every other slot -> map point 1.

const POINT_A := Vector3(0, 1.7, 16)
const POINT_B := Vector3(0, 1.7, -16)
const OTHER_SLOT := 3

func test_slot_zero_takes_first_point_others_take_second() -> void:
	var out := Spawns.positions_for([0, 1, OTHER_SLOT], [POINT_A, POINT_B])
	assert_eq(out[0], POINT_A)
	assert_eq(out[1], POINT_B)
	assert_eq(out[OTHER_SLOT], POINT_B)

func test_from_raw_reads_map_spawns_as_vectors() -> void:
	var raw := {"spawns": [[0, 1.7, 16], [0, 1.7, -16]]}
	assert_eq(Spawns.from_raw(raw), [POINT_A, POINT_B])
