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
		# the ghost's time left, so a remote ghost counts down on every screen (0..1 of RESPAWN_GHOST_MS)
		"respawn_left": p.respawn_timer / MatchConst.RESPAWN_GHOST_MS if p.respawning else 0.0,
	}

## Apply a remote player's snapshot (web applyNetState): position, aim, life and the visual flags the player then shows
## instead of a local simulation. Combat is judged by owners. A demo frame adds the HUD readiness ("beam", "dash_ready",
## "shield_ready", 1 = ready) and the ghost time left ("respawn_left", 1 -> 0).
static func apply_player_snapshot(p, s: Dictionary) -> void:
	var pos: Array = s["pos"]
	p.body.position = Vector3(pos[0], pos[1], pos[2])
	var aim: Array = s["aim"]
	p.set_look(Vector3(aim[0], aim[1], aim[2]))
	p.alive = bool(s["alive"])
	p.respawning = bool(s["respawning"])
	if p.remote == null:
		p.remote = RemoteState.new()
	p.remote.windup = float(s.get("windup", 0.0))
	p.remote.dashing = bool(s.get("dashing", false))
	p.remote.shield = bool(s.get("shield", false))
	p.remote.beam_progress = float(s.get("beam", RemoteState.READY))
	p.remote.dash_progress = float(s.get("dash_ready", RemoteState.READY))
	p.remote.shield_progress = float(s.get("shield_ready", RemoteState.READY))
	if p.respawning:
		p.respawn_timer = float(s.get("respawn_left", 0.0)) * MatchConst.RESPAWN_GHOST_MS
