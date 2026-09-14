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
			NetProtocol.apply_player_snapshot(players[id], s)

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
		return {}
	var victim = players[hit_id]
	var shooter = players[shooter_id]
	if victim == shooter:
		return {}
	if shooter.team == victim.team:
		return {}                    # teammate: no harm
	if not victim.alive:
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
		return {}
	var res: String = victim.receive_hit()   # the shield on the victim's screen wins
	var verdict: Dictionary
	if res == "blocked":
		verdict = {"t": "block", "shooter": shooter_id, "victim": hit_id, "perfect": victim.is_perfect_block()}
	else:
		verdict = {"t": "kill", "shooter": shooter_id, "victim": hit_id}
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
			if not owned_ids.has(v) and _sender_owns(from, v):
				return rules.apply_combat_event(e)
		"respawn":
			var id := int(e["id"])
			if players.has(id) and not owned_ids.has(id) and _sender_owns(from, id):
				var pos: Array = e["pos"]
				players[id].respawn_at(Vector3(pos[0], pos[1], pos[2]))
	return {}
