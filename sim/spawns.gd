class_name Spawns
## Match start positions by slot — port of web spawns.ts spawnPositionsFor (the 1v1 rule).
## 2v2 team clusters and FFA host-generated points arrive together with the lobby modes.

const FIRST_SLOT := 0
const FIRST_POINT := 0
const SECOND_POINT := 1

## The map's raw.json "spawns" ([[x, y, z], [x, y, z]]) as Vector3 points.
static func from_raw(raw: Dictionary) -> Array:
	var out: Array = []
	for s in raw["spawns"]:
		out.append(Vector3(s[0], s[1], s[2]))
	return out

## 1v1: slot 0 -> map point 0, every other slot -> map point 1 (web: the pre-modes rule).
static func positions_for(slots: Array, map_spawns: Array) -> Dictionary:
	var out := {}
	for slot in slots:
		out[slot] = map_spawns[FIRST_POINT if slot == FIRST_SLOT else SECOND_POINT]
	return out
