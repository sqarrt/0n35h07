class_name NetSync extends RefCounted
## Ownership-based world sync: each peer serialises the players it OWNS and applies others' snapshots
## to the players it doesn't own. The narrow Match-net contract NetSession drives.

var players := {}       # id -> Player
var owned_ids := {}     # id -> true
var local_id := 0
var tick := 0
var _out_events := []   # events about our owned players, drained by NetSession each tick

func add_player(p, owned: bool) -> void:
	players[p.id] = p
	if owned:
		owned_ids[p.id] = true

func serialize_snapshot() -> Dictionary:
	var ps := []
	for id in players:
		if owned_ids.has(id):
			ps.append(NetProtocol.player_snapshot(players[id]))
	return {"tick": tick, "players": ps}

func apply_peer_snapshot(_from: String, snap: Dictionary) -> void:
	for s in snap["players"]:
		var id := int(s["id"])
		if owned_ids.has(id):
			continue   # never overwrite our own authoritative state
		if players.has(id):
			NetProtocol.apply_player_snapshot(players[id], s)

## Queue an event about our owned players (fired/kill/block/respawn) for broadcast.
func emit_event(e: Dictionary) -> void:
	_out_events.append(e)

func drain_events() -> Array:
	var out := _out_events
	_out_events = []
	return out

## Apply a peer's discrete event to the players we don't own (reliable combat facts).
func apply_peer_event(_from: String, e: Dictionary) -> void:
	match e.get("t", ""):
		"kill":
			var v := int(e["victim"])
			if players.has(v) and not owned_ids.has(v):
				players[v].alive = false
				players[v].respawning = true
		"respawn":
			var id := int(e["id"])
			if players.has(id) and not owned_ids.has(id):
				var pos: Array = e["pos"]
				players[id].body.position = Vector3(pos[0], pos[1], pos[2])
				players[id].alive = true
				players[id].respawning = false
