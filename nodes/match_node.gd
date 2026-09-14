class_name MatchNode extends Node
## Owns the fighting entities and runs the local match each tick (after the entities move/fire):
## entry countdown -> live -> ended when the match clock runs out. The sim MatchRules does
## kill/block/respawn/score; this node drives it, freezes players outside live (web tickPhase),
## re-emits each tick's rule events as signals for the HUD/FX and announces the outcome after the end
## freeze-frame (web endMatch + END_FREEZE_MS).

signal frag(shooter_id: int, victim_id: int, streak: int, first_blood: bool)
signal fired(id: int)
signal blocked(shooter_id: int, victim_id: int, perfect: bool)
signal match_ended(result: Dictionary)
signal singularity_changed(active: bool)   # web World.setBlocksTransparent on the mode switch
signal combat_event(event: Dictionary)      # every rule event as it resolves (web emit / applyEvent -> sfx.combat)

const MS_PER_S := 1000.0
const NO_TEAM := -1

var rules := MatchRules.new()
var phase := MatchPhase.new()
var local_id := 0   # whose point of view the outcome is computed for (web localId)
var roster := Roster.new()   # names, colours and looks of the participants (web RosterEntry list)
var _clock := MatchClock.new(MatchConst.DEFAULT_MATCH_DURATION_MS)
var _entities := {}   # id -> PlayerNode
var _result := {}
var _freeze_left_ms := 0.0
var _announced := false

func _ready() -> void:
	process_physics_priority = 100   # run after the entities' _physics_process each tick

## Match length in ms (0 = no time limit). Set before the match goes live.
func set_duration_ms(ms: float) -> void:
	_clock = MatchClock.new(ms)

func add_entity(pnode: PlayerNode, team: int) -> void:
	pnode.player.team = team
	pnode.player.set_frozen(true)   # frozen until the countdown ends
	_entities[pnode.player.id] = pnode
	rules.add_player(pnode.player)

## Every participant's Player (bots pick their target among them).
func players() -> Array:
	return _entities.values().map(func(pnode: PlayerNode) -> Player: return pnode.player)

## web hud.scores: {id, team, kills, deaths} per participant, in the order they joined.
func scores() -> Array:
	var out: Array = []
	for id in _entities:
		var player: Player = _entities[id].player
		out.append({"id": id, "team": player.team, "kills": player.kills, "deaths": player.deaths})
	return out

func score_of(id: int) -> int:
	return _entities[id].player.kills if _entities.has(id) else 0

## Current kill streak of a player (web streakCounts), 0 for unknown ids.
func streak_of(id: int) -> int:
	return _entities[id].player.streak if _entities.has(id) else 0

## Streak tier per player id ("" for none) — the HUD streaks the result screen keeps on the names.
func streak_tiers() -> Dictionary:
	var tiers := {}
	for id in _entities:
		tiers[id] = Streak.streak_tier(streak_of(id))
	return tiers

func is_live() -> bool:
	return phase.is_live()

func is_ended() -> bool:
	return phase.is_ended()

func countdown_label() -> String:
	return phase.countdown_label()

## Whole seconds left on the match clock, or null when the match has no time limit (HUD shows --:--).
func seconds_left():
	return _clock.seconds_left() if _clock.has_timer() else null

## Milliseconds left on the match clock, INF without a time limit (web musicRemainingMs: the music outro).
func remaining_ms() -> float:
	return _clock.remaining_ms() if _clock.has_timer() else INF

func force_live() -> void:
	phase.force_live()
	_apply_freeze()

func _physics_process(delta: float) -> void:
	phase.update(delta)
	_clock.update(delta, phase.is_live())
	if phase.is_live() and _clock.is_over():
		_end_match()
	_apply_freeze()
	rules.resolve(delta)
	emit_events(rules.events)
	if rules.apply_comeback():   # web: at the top of the next tick, before anyone moves or fires
		singularity_changed.emit(rules.singularity_active)
	_tick_result(delta)

## Re-emit rule events as signals (web Match dispatches BEAM_FLASH / SHIELD_BLOCK / PLAYER_HIT from these facts).
func emit_events(events: Array) -> void:
	for e in events:
		combat_event.emit(e)
		match e["t"]:
			"fired":
				fired.emit(int(e["id"]))
			"block":
				blocked.emit(int(e["shooter"]), int(e["victim"]), bool(e["perfect"]))
			"kill":
				frag.emit(int(e["shooter"]), int(e["victim"]), int(e["streak"]), bool(e["first_blood"]))

## Players move only while live (web: frozen = phase !== 'live'); applied on change so a frozen body isn't re-halted.
func _apply_freeze() -> void:
	var frozen := not phase.is_live()
	for e in _entities.values():
		if e.player.frozen != frozen:
			e.player.set_frozen(frozen)

func _end_match() -> void:
	phase.end()
	var players: Array = _entities.values().map(func(e): return e.player)
	var local_team: int = _entities[local_id].player.team if _entities.has(local_id) else NO_TEAM
	_result = MatchResult.compute(players, local_team, MatchResult.REASON_TIME)
	_freeze_left_ms = MatchConst.END_FREEZE_MS

## The outcome is announced once, after the freeze-frame (the overlay fades in on its own).
func _tick_result(delta: float) -> void:
	if _announced or _result.is_empty():
		return
	_freeze_left_ms -= delta * MS_PER_S
	if _freeze_left_ms <= 0.0:
		_announced = true
		match_ended.emit(_result)
