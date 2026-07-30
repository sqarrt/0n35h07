class_name MatchNode extends Node
## Owns the fighting entities and runs the local match rules each tick (after the entities move/fire).
## The sim MatchRules does kill/block/respawn/score; this node just drives it and exposes scores.

signal frag(shooter_id: int, victim_id: int, streak: int, first_blood: bool)

var rules := MatchRules.new()
var phase := MatchPhase.new()
var _entities := {}   # id -> PlayerNode

func _ready() -> void:
	process_physics_priority = 100   # run after the entities' _physics_process each tick

func add_entity(pnode: PlayerNode, team: int) -> void:
	pnode.player.team = team
	pnode.player.set_frozen(true)   # frozen until the countdown ends
	_entities[pnode.player.id] = pnode
	rules.add_player(pnode.player)

func score_of(id: int) -> int:
	return _entities[id].player.kills if _entities.has(id) else 0

func is_live() -> bool:
	return phase.is_live()

func countdown_label() -> String:
	return phase.countdown_label()

func force_live() -> void:
	phase.force_live()
	for e in _entities.values():
		e.player.set_frozen(false)

func _physics_process(delta: float) -> void:
	var was_live := phase.is_live()
	phase.update(delta)
	if phase.is_live() and not was_live:
		for e in _entities.values():
			e.player.set_frozen(false)   # unfreeze once, when the countdown ends
	rules.resolve(delta)
	for e in rules.events:
		if e["t"] == "kill":
			frag.emit(int(e["shooter"]), int(e["victim"]), int(e["streak"]), bool(e["first_blood"]))
