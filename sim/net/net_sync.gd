class_name NetSync extends RefCounted
## Ownership-based world sync: each peer serialises the players it OWNS and applies others' snapshots
## to the players it doesn't own. The narrow Match-net contract NetSession drives; a MatchNode shares its rules with it.

var players := {}       # id -> Player
var owned_ids := {}     # id -> true
var local_id := 0
var tick := 0
var _out_events := []   # events about our owned players, drained by NetSession each tick
var _out_claims := []   # hit claims addressed to victims' owners, drained each tick
var owner_of := {}      # id -> peer id; configured for mesh play, empty for local-only fixtures
var rules: MatchRules
var clock_ms := Callable(Time, "get_ticks_msec")   # the kill prediction's grace runs on it (tests pin it)
var predicted_kill := {}   # {id, until}: a remote victim the local player's shot predicted dead (web predictedKill)

## `match_rules`: the rules the verdicts score in (a MatchNode's own); a fresh set when omitted.
func _init(match_rules: MatchRules = null) -> void:
	rules = match_rules if match_rules != null else MatchRules.new()

## `register`: also add the player to the rules (a MatchNode has already).
func add_player(p, owned: bool, register := true) -> void:
	players[p.id] = p
	if register:
		rules.add_player(p)
	if owned:
		owned_ids[p.id] = true

func serialize_snapshot() -> Dictionary:
	var ps := []
	for id in players:
		if owned_ids.has(id):
			ps.append(NetProtocol.player_snapshot(players[id]))
	return {"tick": tick, "players": ps}

func apply_peer_snapshot(from: String, snap: Dictionary) -> void:
	for s in snap["players"]:
		var id := int(s["id"])
		if owned_ids.has(id):
			continue   # never overwrite our own authoritative state
		if not _sender_owns(from, id):
			continue
		if players.has(id):
			NetProtocol.apply_player_snapshot(players[id], _predicted_state(id, s))

## web applyPeerSnapshot with a latched prediction: an alive snapshot sent before our claim arrived keeps the ghost
## until the grace runs out (then the claim was rejected or lost: revive); a dead one means the owner confirmed it.
func _predicted_state(id: int, s: Dictionary) -> Dictionary:
	if predicted_kill.get("id") != id:
		return s
	if not bool(s["alive"]):
		predicted_kill = {}
		return s
	if float(clock_ms.call()) < float(predicted_kill["until"]):
		var held := s.duplicate()
		held["alive"] = false
		held["respawning"] = true
		return held
	_revert_prediction(id, "grace")
	return s

## web predictOpponentDeath: our shot hit a remote victim — show its death now, before its owner's verdict. A visibly
## shielded victim is left to its owner (the verdict will be a block).
func predict_death(victim_id: int) -> void:
	var victim = players.get(victim_id)
	if victim == null or not victim.alive:
		return
	if victim.is_shielded():
		GameLog.log("act", "predict_skip", {"victim": victim_id, "reason": "shield"})
		return
	victim.apply_death()
	predicted_kill = {"id": victim_id, "until": float(clock_ms.call()) + NetConst.NET_PREDICT_KILL_MS}
	GameLog.log("act", "predict_death", {"victim": victim_id})

## web revertPredictedKill: the owner blocked our shot or the claim never landed — undo the local death, hitbox included.
func _revert_prediction(victim_id: int, reason: String) -> void:
	predicted_kill = {}
	players[victim_id].revive_from_false_prediction()
	GameLog.warn("act", "predict_revert", {"victim": victim_id, "reason": reason})

## Queue an event about our owned players (fired/kill/block/respawn) for broadcast.
func emit_event(e: Dictionary) -> void:
	_out_events.append(e)

func drain_events() -> Array:
	var out := _out_events
	_out_events = []
	return out

# --- shooter-authoritative, victim-judged combat ---

## Route a local shot's claim: judge now if we own the victim, else address it to the victim's owner.
func queue_or_judge(claim: Dictionary) -> void:
	if claim.get("hit_id") == null or claim.get("shooter") == null:
		return
	var hit_id: int = int(claim.get("hit_id", -1))
	var shooter_id: int = int(claim.get("shooter", -1))
	if not players.has(hit_id) or not owned_ids.has(shooter_id):
		return
	if owned_ids.has(hit_id):
		judge_claim(local_id_peer(), claim)
	elif owner_of.has(hit_id) and owner_of[hit_id] != "":
		_out_claims.append({"to": owner_of[hit_id], "claim": claim})

## Judge an incoming claim against a victim WE own — the victim's real local state decides.
## Broadcasts a slim kill/block verdict (as an event) that every peer derives numbers from; returns the verdict as a
## local event, or {} when the claim is dropped.
func judge_claim(from: String, claim: Dictionary) -> Dictionary:
	if claim.get("hit_id") == null or claim.get("shooter") == null:
		return {}
	var hit_id: int = int(claim.get("hit_id", -1))
	var shooter_id: int = int(claim.get("shooter", -1))
	if not owned_ids.has(hit_id):
		return {}
	if not players.has(hit_id) or not players.has(shooter_id):
		return {}
	if not _sender_owns(from, shooter_id):
		GameLog.warn("act", "claim_drop", {"shooter": shooter_id, "from": from, "reason": "not_owner"})
		return {}
	var victim = players[hit_id]
	var shooter = players[shooter_id]
	if victim == shooter:
		GameLog.warn("act", "claim_drop", {"shooter": shooter_id, "victim": hit_id, "reason": "bad_target"})
		return {}
	if shooter.team == victim.team:
		GameLog.warn("act", "claim_drop", {"shooter": shooter_id, "victim": hit_id, "reason": "teammate"})
		return {}                    # teammate: no harm
	if not victim.alive:
		GameLog.log("act", "claim_drop", {"shooter": shooter_id, "victim": hit_id, "reason": "dead"})
		return {}
	var point: Vector3 = victim.position()
	var claim_point = claim.get("point")
	if claim_point != null:
		if not claim_point is Array or claim_point.size() != 3:
			return {}
		for component in claim_point:
			if not (component is float or component is int):
				return {}
		point = Vector3(claim_point[0], claim_point[1], claim_point[2])
	var distance: float = shooter.position().distance_to(point)
	if not is_finite(distance) or distance > CombatConst.AIM_RANGE:
		GameLog.warn("act", "claim_drop", {"shooter": shooter_id, "victim": hit_id, "reason": "range", "dist": distance})
		return {}
	GameLog.log("act", "claim_judge", {"shooter": shooter_id, "victim": hit_id, "dist": distance})
	var res: String = victim.receive_hit()   # the shield on the victim's screen wins
	var verdict: Dictionary
	if res == "blocked":
		verdict = {"t": "block", "shooter": shooter_id, "victim": hit_id, "perfect": victim.is_perfect_block()}
		GameLog.log("act", "block", {"shooter": shooter_id, "victim": hit_id, "perfect": verdict["perfect"]})
	else:
		verdict = {"t": "kill", "shooter": shooter_id, "victim": hit_id}
		GameLog.log("act", "kill", {"shooter": shooter_id, "victim": hit_id})
	var local := rules.apply_combat_event(verdict)
	emit_event(verdict)
	return local

func drain_claims() -> Array:
	var out := _out_claims
	_out_claims = []
	return out

func local_id_peer() -> String:
	return owner_of.get(local_id, "")

func _sender_owns(from: String, id: int) -> bool:
	return owner_of.is_empty() or (owner_of.has(id) and owner_of[id] == from)

## Only the victim's owner judges combat; all peers derive the same scores and rewards. Returns an applied kill / block
## as a local event ({} otherwise).
func apply_peer_event(from: String, e: Dictionary) -> Dictionary:
	match e.get("t", ""):
		"kill", "block":
			var v := int(e["victim"])
			if owned_ids.has(v):
				return {}
			if not _sender_owns(from, v):
				GameLog.warn("act", "event_drop", {"t": e["t"], "from": from, "victim": v})
				return {}
			var fields := {"side": "remote", "shooter": e.get("shooter"), "victim": v}
			if e["t"] == "block":
				fields["perfect"] = bool(e.get("perfect", false))
			GameLog.log("act", e["t"], fields)
			if predicted_kill.get("id") == v:
				if e["t"] == "kill":                    # web applyKill: the owner confirmed our predicted death
					predicted_kill = {}
					GameLog.log("act", "predict_confirm", {"victim": v})
				else:                                   # web applyBlock: the owner's shield won
					_revert_prediction(v, "block")
			return rules.apply_combat_event(e)
		"respawn":
			var id := int(e["id"])
			if players.has(id) and not owned_ids.has(id):
				if not _sender_owns(from, id):
					GameLog.warn("act", "event_drop", {"t": "respawn", "from": from, "id": id})
					return {}
				GameLog.log("act", "respawn", {"side": "remote", "id": id})
				var pos: Array = e["pos"]
				players[id].respawn_at(Vector3(pos[0], pos[1], pos[2]))
	return {}
