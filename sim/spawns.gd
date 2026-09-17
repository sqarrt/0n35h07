class_name Spawns
## Match start positions by slot — port of web game/spawns.ts: 1v1 the two map points; 2v2 team clusters around the
## map points; FFA the creator's random points (genFfaSpawns) in seat order.

const FIRST_SLOT := 0
const FIRST_POINT := 0
const SECOND_POINT := 1
const MAP_POINTS := 2
const CLUSTER_OFFSETS := [Vector2(-0.9, 0.0), Vector2(0.9, 0.0)]   # web SPAWN_CLUSTER_OFFSETS (XZ, capsules apart)
const FFA_HALF := 14.0                  # web SPAWN_HALF: inside the arena square
const FFA_MIN_DIST := 6.0               # web FFA_SPAWN_MIN_DIST
const FFA_MAX_TRIES := 200              # web FFA_SPAWN_MAX_TRIES
const TWICE := 2.0

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

## web spawnPositionsFor: the mode's start rule for the seated slots (in seat order).
static func positions_for_mode(mode: String, slots: Array, map_spawns: Array, ffa_spawns: Array = []) -> Dictionary:
	if mode == GameModes.WAR and not ffa_spawns.is_empty():
		var out := {}
		for i in slots.size():
			out[slots[i]] = ffa_spawns[i] if i < ffa_spawns.size() else map_spawns[i % MAP_POINTS]
		return out
	if mode == GameModes.BATTLE:
		var out := {}
		var placed := [0, 0]                   # members already placed per team -> offset within the cluster
		for slot in slots:
			var team := GameModes.team_of_slot(mode, slot)
			var offset: Vector2 = CLUSTER_OFFSETS[placed[team] % CLUSTER_OFFSETS.size()]
			placed[team] += 1
			out[slot] = (map_spawns[team] as Vector3) + Vector3(offset.x, 0.0, offset.y)
		return out
	return positions_for(slots, map_spawns)

## web genFfaSpawns: `count` points inside the arena square at height `y`, each as far from the others as a few
## hundred random tries find (the first try that clears the minimum distance wins).
static func gen_ffa_spawns(count: int, y: float, rng: Callable) -> Array:
	var points: Array = []
	for i in count:
		var best := Vector3(0.0, y, 0.0)
		var best_near := -1.0
		for t in FFA_MAX_TRIES:
			var candidate := Vector3((float(rng.call()) * TWICE - 1.0) * FFA_HALF, y, (float(rng.call()) * TWICE - 1.0) * FFA_HALF)
			var near := INF
			for p in points:
				near = minf(near, Vector2(candidate.x - p.x, candidate.z - p.z).length())
			if near > best_near:
				best = candidate
				best_near = near
			if near >= FFA_MIN_DIST:
				break
		points.append(best)
	return points
