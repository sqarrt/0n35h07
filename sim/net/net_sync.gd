class_name NetSync extends RefCounted
## Ownership-based world sync: each peer serialises the players it OWNS and applies others' snapshots
## to the players it doesn't own. The narrow Match-net contract NetSession drives.

var players := {}       # id -> Player
var owned_ids := {}     # id -> true
var local_id := 0
var tick := 0

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
