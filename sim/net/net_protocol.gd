class_name NetProtocol
## Snapshot/event message shapes (JSON-friendly Dictionaries) + apply helpers. Ported from protocol.ts.

## A snapshot of one owned player.
static func player_snapshot(p) -> Dictionary:
	var pos: Vector3 = p.position()
	var aim: Vector3 = p.look_dir()
	return {
		"id": p.id,
		"pos": [pos.x, pos.y, pos.z],
		"aim": [aim.x, aim.y, aim.z],
		"alive": p.alive,
		"shield": p.is_shielded(),
		"dashing": p.is_dashing(),
		"windup": p.windup_progress(),
		"respawning": p.respawning,
	}

## Apply a remote player's snapshot (position/aim/alive/respawning). Combat is judged by owners.
static func apply_player_snapshot(p, s: Dictionary) -> void:
	var pos: Array = s["pos"]
	p.body.position = Vector3(pos[0], pos[1], pos[2])
	var aim: Array = s["aim"]
	p.set_look(Vector3(aim[0], aim[1], aim[2]))
	p.alive = bool(s["alive"])
	p.respawning = bool(s["respawning"])
