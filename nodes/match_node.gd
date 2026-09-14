class_name MatchNode extends Node
## Owns the fighting entities and runs the match each tick (after the entities move/fire):
## the ready ritual -> countdown -> live -> ended when the match clock runs out. The sim MatchRules does
## kill/block/respawn/score; this node drives it, freezes players outside live (web tickPhase),
## re-emits each tick's rule events as signals for the HUD/FX and announces the outcome after the end
## freeze-frame (web endMatch + END_FREEZE_MS). On a mesh (configure_mesh) it simulates only the players this peer owns:
## their facts go out through a NetSync, the other players follow their owners' snapshots ~100 ms in the past and
## their owners' events, verdicts on our players are ours to judge, the lobby creator stamps the phase, and a vanished
## peer's players leave (web Match owners / applyPeer* / judgeClaim / handlePeerLeft).

signal frag(shooter_id: int, victim_id: int, streak: int, first_blood: bool)
signal fired(id: int)
signal blocked(shooter_id: int, victim_id: int, perfect: bool)
signal match_ended(result: Dictionary)
signal singularity_changed(active: bool)   # web World.setBlocksTransparent on the mode switch
signal combat_event(event: Dictionary)      # every rule event as it resolves (web emit / applyEvent -> sfx.combat)

const MS_PER_S := 1000.0
const NO_TEAM := -1
const CREATOR_SLOT := 0                     # web iAmCreator: the lobby creator owns seat 0
const REASON_DISCONNECT := "disconnect"     # web endMatch('disconnect'): fewer than two teams remain
const MIN_TEAMS := 2

var rules := MatchRules.new()
var phase := MatchPhase.new()
var local_id := 0   # whose point of view the outcome is computed for (web localId)
var replay := false   # a demo replay: the playback sets scores, streaks and the clock; no phase, clock or rules run
var replay_seconds_left := 0
var roster := Roster.new()   # names, colours and looks of the participants (web RosterEntry list)
var mesh: NetSync = null     # a networked match: who simulates and judges each player (null: a local match)
var net_session: NetSession = null   # ships this peer's facts after every tick (web session.afterUpdate)
var self_peer := ""          # this peer's transport id on a mesh
var clock_ms := Callable(Time, "get_ticks_msec")   # the wall clock remote interpolation runs on (tests pin it)
var _clock := MatchClock.new(MatchConst.DEFAULT_MATCH_DURATION_MS)
var _entities := {}   # id -> PlayerNode
var _interp := {}     # remote id -> InterpBuffer
var _left := {}       # id -> true: its peer left (web leftIds)
var _result := {}
var _freeze_left_ms := 0.0
var _announced := false
var _logged_phase := ""                     # session log (web Match diag): the phase last logged
var _phase_entered_ms := 0.0
var _phase_warned := false
var _last_health_ms := -INF
var _actor_prev := {}                       # id -> {shield, dash} at the last tick

func _ready() -> void:
	process_physics_priority = 100   # run after the entities' _physics_process each tick

## Match length in ms (0 = no time limit). Set before the match goes live.
func set_duration_ms(ms: float) -> void:
	_clock = MatchClock.new(ms)

## A networked match (web Match owners / selfPeer): who simulates each player (id -> peer). Call before add_entity.
func configure_mesh(owners: Dictionary, peer: String) -> void:
	self_peer = peer
	mesh = NetSync.new(rules)
	mesh.local_id = local_id
	for id in owners:
		mesh.owner_of[int(id)] = owners[id]
	rules.owns = owns
	phase.creator = owner_of(CREATOR_SLOT) == self_peer

## The peer simulating a player (this peer when it isn't listed).
func owner_of(id: int) -> String:
	return mesh.owner_of.get(id, self_peer) if mesh != null else self_peer

## Whether this peer simulates the player (every player in a local match).
func owns(id: int) -> bool:
	return mesh == null or owner_of(id) == self_peer

## A participant; `ready` confirms its seat in the ready ritual at once (web: bots are auto-ready).
func add_entity(pnode: PlayerNode, team: int, ready := false) -> void:
	pnode.player.team = team
	pnode.player.set_frozen(true)   # frozen until the countdown ends
	_entities[pnode.player.id] = pnode
	rules.add_player(pnode.player)
	phase.add_participant(pnode.player.id, ready)
	if mesh != null:
		mesh.add_player(pnode.player, owns(pnode.player.id), false)
		if not owns(pnode.player.id):
			_interp[pnode.player.id] = InterpBuffer.new()

## web markReady: a participant confirms (the local player's click); returns whether it was news. Our own players'
## readiness goes out to the mesh.
func mark_ready(id: int) -> bool:
	var news := phase.mark_ready(id)
	if news and mesh != null and owns(id):
		mesh.emit_event({"t": "ready", "id": id})
	return news

func ready_ids() -> Array:
	return phase.ready_ids()

func is_ready_phase() -> bool:
	return phase.is_ready_phase()

## Every participant's Player still in the match (bots pick their target among them).
func players() -> Array:
	return _entities.keys().filter(func(id: int) -> bool: return not _left.has(id)) \
		.map(func(id: int) -> Player: return _entities[id].player)

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
	if replay:
		return replay_seconds_left   # web hudOf: the recording's clock
	return _clock.seconds_left() if _clock.has_timer() else null

## Milliseconds left on the match clock, INF without a time limit (web musicRemainingMs: the music outro).
func remaining_ms() -> float:
	return _clock.remaining_ms() if _clock.has_timer() else INF

func force_live() -> void:
	phase.force_live()
	_apply_freeze()

func _physics_process(delta: float) -> void:
	if replay:
		return
	phase.update(delta)
	_clock.update(delta, phase.is_live())
	if phase.is_live() and _clock.is_over():
		_end_match()
	_apply_freeze()
	rules.resolve(delta)
	emit_events(rules.events)
	if mesh != null:
		_share(rules.events)
		for claim in rules.claims:
			mesh.queue_or_judge(claim)
		_place_remotes()
	if rules.apply_comeback():   # web: at the top of the next tick, before anyone moves or fires
		singularity_changed.emit(rules.singularity_active)
	_tick_result(delta)
	_log_diag()
	if net_session != null:
		net_session.after_update(float(clock_ms.call()))

## Session log (web Match diag): each phase transition once, a pre-live phase stuck past the watchdog, a health line
## every couple of seconds while live, and every player's shield / dash edges.
func _log_diag() -> void:
	if not GameLog.is_active():
		return
	var now := float(clock_ms.call())
	var current: String = MatchPhase.NAMES[phase.phase]
	if current != _logged_phase:
		_logged_phase = current
		_phase_entered_ms = now
		_phase_warned = false
		GameLog.log("phase", current, {"creator": phase.creator, "ready": phase.ready_ids()})
	elif not phase.is_live() and not phase.is_ended() and not _phase_warned \
			and now - _phase_entered_ms > GameLog.PHASE_WATCHDOG_MS:
		_phase_warned = true
		GameLog.warn("phase", "stuck", {"phase": current, "ms": now - _phase_entered_ms, "ready": phase.ready_ids()})
	if phase.is_live() and now - _last_health_ms >= GameLog.HEALTH_HEARTBEAT_MS:
		_last_health_ms = now
		GameLog.log("health", "tick", {"peers": _entities.size()})
	for id in _entities:
		var player = (_entities[id] as PlayerNode).player
		var shield: bool = player.shield_active()
		var dash: bool = player.is_dashing()
		var prev: Dictionary = _actor_prev.get(id, {"shield": false, "dash": false})
		if shield != prev["shield"]:
			GameLog.log("act", "shield", {"id": id, "on": shield})
		if dash and not prev["dash"]:
			GameLog.log("act", "dash", {"id": id})
		_actor_prev[id] = {"shield": shield, "dash": dash}

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

# --- the mesh contract (NetSession) ---

func serialize_snapshot() -> Dictionary:
	return mesh.serialize_snapshot()

func drain_events() -> Array:
	return mesh.drain_events()

func drain_claims() -> Array:
	return mesh.drain_claims()

## web applyPeerSnapshot: the owner's facts for its players, their positions buffered for rendering in the past.
func apply_peer_snapshot(from: String, snapshot: Dictionary) -> void:
	mesh.apply_peer_snapshot(from, snapshot)
	var now := float(clock_ms.call())
	for state in snapshot.get("players", []):
		var id := int(state["id"])
		if _interp.has(id) and owner_of(id) == from:
			var pos: Array = state["pos"]
			(_interp[id] as InterpBuffer).push(now, pos[0], pos[1], pos[2], int(snapshot.get("tick", 0)))

## web applyPeerEvent: only the owner speaks for its players (for a verdict, the victim's owner).
func apply_peer_event(from: String, event: Dictionary) -> void:
	match String(event.get("t", "")):
		"kill", "block":
			var local := mesh.apply_peer_event(from, event)
			if not local.is_empty():
				emit_events([local])
		"fired":
			var id := int(event.get("id", -1))
			if not _speaks_for(from, id):
				return
			var end := _vector(event["end"])
			var hit = event.get("hit_point")
			var hit_point = _vector(hit) if hit != null else null
			_entities[id].play_remote_beam(end, hit_point)
			emit_events([{"t": "fired", "id": id, "end": end, "hit_point": hit_point, "hit": int(event.get("hit", -1))}])
		"respawn":
			var id := int(event.get("id", -1))
			if not _speaks_for(from, id):
				return
			mesh.apply_peer_event(from, event)
			var at := _vector(event["pos"])
			_entities[id].place_at(at)
			_interp[id] = InterpBuffer.new()             # web setPosition: the buffered history is invalid now
			emit_events([{"t": "respawn", "id": id, "pos": at}])
		"ready":
			var id := int(event.get("id", -1))
			if _speaks_for(from, id):
				phase.mark_ready(id)                     # the creator stamps the countdown once everyone is ready

## A claim on one of our players: the victim's real local state decides, and the verdict scores here too.
func judge_claim(from: String, claim: Dictionary) -> void:
	var local := mesh.judge_claim(from, claim)
	if not local.is_empty():
		emit_events([local])

func phase_dirty() -> bool:
	return phase.dirty

func clear_phase_dirty() -> void:
	phase.dirty = false

func serialize_phase() -> Dictionary:
	return phase.serialize()

func i_am_creator() -> bool:
	return phase.creator

func creator_peer() -> String:
	return owner_of(CREATOR_SLOT)

## web applyPhase: the creator's phase; an ended one concludes the match here too.
func apply_phase(message: Dictionary) -> void:
	phase.apply(message)
	if phase.is_ended():
		_end_match()

## web handlePeerLeft: every player the vanished peer simulated leaves (its bots with it).
func handle_peer_left(peer: String) -> void:
	for id in _entities.keys():
		if owner_of(id) == peer:
			handle_player_left(id)

## web handlePlayerLeft: the model goes; the match ends once fewer than two teams remain.
func handle_player_left(id: int) -> void:
	if _left.has(id) or not _entities.has(id):
		return
	_left[id] = true
	(_entities[id] as PlayerNode).visible = false
	var teams := {}
	for other in _entities:
		if not _left.has(other):
			teams[_entities[other].player.team] = true
	if teams.size() < MIN_TEAMS:
		_end_match(REASON_DISCONNECT)

## Our own facts for the mesh, slim and wire-friendly (web emit: numbers are derived by every peer).
func _share(events: Array) -> void:
	for e in events:
		match e["t"]:
			"fired":
				mesh.emit_event({"t": "fired", "id": e["id"], "end": _wire(e["end"]), "hit_point": _wire(e["hit_point"]),
					"hit": e["hit"]})
			"kill":
				mesh.emit_event({"t": "kill", "shooter": e["shooter"], "victim": e["victim"]})
			"block":
				mesh.emit_event({"t": "block", "shooter": e["shooter"], "victim": e["victim"], "perfect": e["perfect"]})
			"respawn":
				mesh.emit_event({"t": "respawn", "id": e["id"], "pos": _wire(e["pos"])})

## web nextRemoteTranslation: every remote player where its owner had it NET_INTERP_DELAY_MS ago.
func _place_remotes() -> void:
	var render_ms := float(clock_ms.call()) - NetConst.NET_INTERP_DELAY_MS
	for id in _interp:
		var at = (_interp[id] as InterpBuffer).sample(render_ms)
		if at != null and _entities.has(id):
			(_entities[id] as PlayerNode).place_at(at)

func _speaks_for(from: String, id: int) -> bool:
	return _entities.has(id) and not owns(id) and owner_of(id) == from

## Players move only while live (web: frozen = phase !== 'live'); applied on change so a frozen body isn't re-halted.
func _apply_freeze() -> void:
	var frozen := not phase.is_live()
	for e in _entities.values():
		if e.player.frozen != frozen:
			e.player.set_frozen(frozen)

## web endMatch: once; the time runs out on a live match, a disconnect ends it from any phase.
func _end_match(reason := MatchResult.REASON_TIME) -> void:
	phase.end(reason == REASON_DISCONNECT)
	if not _result.is_empty() or not phase.is_ended():
		return
	var players: Array = players()
	var local_team: int = _entities[local_id].player.team if _entities.has(local_id) else NO_TEAM
	GameLog.log("phase", "match_end", {"reason": reason})   # web endMatch: once per peer
	_result = MatchResult.compute(players, local_team, reason)
	_freeze_left_ms = MatchConst.END_FREEZE_MS

## The outcome is announced once, after the freeze-frame (the overlay fades in on its own).
func _tick_result(delta: float) -> void:
	if _announced or _result.is_empty():
		return
	_freeze_left_ms -= delta * MS_PER_S
	if _freeze_left_ms <= 0.0:
		_announced = true
		match_ended.emit(_result)

static func _wire(point):
	return [point.x, point.y, point.z] if point is Vector3 else null

static func _vector(values) -> Vector3:
	return Vector3(values[0], values[1], values[2])
