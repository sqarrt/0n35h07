class_name MatchRules extends RefCounted
## Local match rules: one-shot kill / shield block / ghost respawn / teams / score / streak / bounty.
## Ported from the web Match combat path (resolveCombat/resolveHit/applyKill/applyBlock/resolveRespawns).
## Reads each player's newest weapon outcome via fire_seq, so it's independent of the FX layer.

var players: Array = []          # Array[Player]
var events: Array = []           # collected each resolve() for the host to reflect (FX/HUD)
var first_kill_done := false
var singularity_active := false  # someone is on a SINGULARITY streak: everyone pierces, blocks see-through

var _last_seq := {}              # id -> last processed weapon.fire_seq

func add_player(p) -> void:
	players.append(p)
	_last_seq[p.id] = 0

func _by_id(eid: int):
	for p in players:
		if p.id == eid:
			return p
	return null

## Resolve every player's newest fire, then tick respawns. Call once per tick; read `events`.
func resolve(dt: float) -> void:
	events.clear()
	_resolve_combat()
	_resolve_respawns(dt)

## web Match.applyComeback: OVERHEAT for everyone, and pierce for ALL players while anyone is see-through.
## Returns true when the SINGULARITY mode switched (the host toggles the block see-through then).
func apply_comeback() -> bool:
	var singularity := false
	for p in players:
		p.apply_overheat()
		singularity = singularity or p.see_through()
	for p in players:
		p.pierce_walls = singularity
	if singularity == singularity_active:
		return false
	singularity_active = singularity
	return true

func _resolve_combat() -> void:
	for shooter in players:
		var w = shooter.weapon
		if w == null:
			continue
		if w.fire_seq <= int(_last_seq.get(shooter.id, 0)):
			continue
		_last_seq[shooter.id] = w.fire_seq
		var o: Dictionary = w.outcome
		events.append({"t": "fired", "id": shooter.id, "end": o["end"], "hit_point": o["hit_point"], "hit": int(o["hit_entity_id"])})
		var eid: int = int(o["hit_entity_id"])
		if eid >= 0:
			var victim = _by_id(eid)
			if victim != null:
				_resolve_hit(shooter, victim, o["hit_point"])

func _resolve_hit(shooter, victim, point) -> void:
	if shooter != victim and shooter.team == victim.team:
		return                    # teammate bodies block the beam but take no harm
	if not victim.alive:
		return
	var res: String = victim.receive_hit()
	if res == "blocked":
		var perfect: bool = victim.is_perfect_block()
		_apply_block(shooter, victim, perfect)
		events.append({"t": "block", "shooter": shooter.id, "victim": victim.id, "perfect": perfect})
	else:
		var first_blood := _apply_kill(shooter, victim)
		events.append({"t": "kill", "shooter": shooter.id, "victim": victim.id, "point": point,
			"streak": (shooter.streak if shooter != victim else 0), "first_blood": first_blood})

func _apply_kill(shooter, victim) -> bool:
	if victim.alive:
		victim.apply_death()
	victim.deaths += 1
	var broken: int = victim.streak
	victim.streak = 0
	var first_blood := false
	if shooter != victim:
		shooter.kills += Overheat.bounty_frags(broken)
		shooter.streak += 1
		if not first_kill_done:
			first_blood = true
			first_kill_done = true
		if Overheat.break_resets_cooldowns(broken):
			shooter.reset_cooldowns()
	return first_blood

func _apply_block(_shooter, victim, perfect: bool) -> void:
	if perfect:
		victim.reset_cooldowns()

## Apply an already judged network verdict using the same score/reward rules as local combat.
## The caller checks ownership; receive_hit must only run on the victim's owner.
func apply_combat_event(e: Dictionary) -> void:
	var shooter = _by_id(int(e.get("shooter", -1)))
	var victim = _by_id(int(e.get("victim", -1)))
	if shooter == null or victim == null:
		return
	match e.get("t", ""):
		"kill":
			_apply_kill(shooter, victim)
		"block":
			_apply_block(shooter, victim, bool(e.get("perfect", false)))

func _resolve_respawns(dt: float) -> void:
	for p in players:
		if not p.respawning:
			continue
		p.respawn_timer -= dt * 1000.0
		if p.respawn_timer <= 0.0:
			p.respawn_at(p.position())
			events.append({"t": "respawn", "id": p.id, "pos": p.position()})
