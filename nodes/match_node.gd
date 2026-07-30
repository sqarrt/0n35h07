class_name MatchNode extends Node
## Owns the fighting entities and runs the local match rules each tick (after the entities move/fire).
## The sim MatchRules does kill/block/respawn/score; this node just drives it and exposes scores.

signal frag(shooter_id: int, victim_id: int, streak: int, first_blood: bool)

var rules := MatchRules.new()
var _entities := {}   # id -> PlayerNode

func _ready() -> void:
	process_physics_priority = 100   # run after the entities' _physics_process each tick

func add_entity(pnode: PlayerNode, team: int) -> void:
	pnode.player.team = team
	_entities[pnode.player.id] = pnode
	rules.add_player(pnode.player)

func score_of(id: int) -> int:
	return _entities[id].player.kills if _entities.has(id) else 0

func _physics_process(delta: float) -> void:
	rules.resolve(delta)
	for e in rules.events:
		if e["t"] == "kill":
			frag.emit(int(e["shooter"]), int(e["victim"]), int(e["streak"]), bool(e["first_blood"]))
