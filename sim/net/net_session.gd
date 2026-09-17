class_name NetSession extends RefCounted
## Symmetric mesh orchestrator over the transport (INet): every peer runs the SAME session — ported from NetSession.ts.
## Each peer broadcasts its own facts (events every tick, snapshots of its owned players throttled), ships hit claims to
## the victim's owner, applies the other peers' snapshots / events / claims, takes the phase from the lobby creator only,
## and hands a vanished peer's players to the match. A match without a phase (NetSync fixtures) skips those parts.

const TAG_SNAPSHOT := "snapshot"
const TAG_EVENT := "event"
const TAG_HIT := "hit"
const TAG_PHASE := "phase"
const TAG_DIGEST := "digest"
const MS_PER_S := 1000.0

var _net
var _match
var _last_snapshot_at := -1000000.0
var _last_digest_at := -1000000.0
var _snapshot_interval := 1000.0 / NetConst.NET_SNAPSHOT_HZ

func _init(net, match_obj) -> void:
	_net = net
	_match = match_obj
	_net.on(TAG_SNAPSHOT, func(payload, from): _match.apply_peer_snapshot(from, payload))
	_net.on(TAG_EVENT, func(payload, from): _match.apply_peer_event(from, payload))
	_net.on(TAG_HIT, func(payload, from): _match.judge_claim(from, payload))
	if _match.has_method("apply_phase"):
		_net.on(TAG_PHASE, func(payload, from):
			if from != _match.creator_peer():   # only the lobby creator stamps the phase
				GameLog.warn("phase", "phase_drop", {"from": from})
				return
			_match.apply_phase(payload))
	if _match.has_method("compare_digest"):
		_net.on(TAG_DIGEST, func(payload, from): _match.compare_digest(from, payload))
	if _match.has_method("handle_peer_left"):
		_net.on_peer_leave(func(peer):
			GameLog.warn("transport", "peer_left", {"peer": peer})
			_match.handle_peer_left(peer))

## Send outgoing data after the simulation step (now in ms).
func after_update(now_ms: float) -> void:
	if _match.has_method("phase_dirty") and _match.phase_dirty():
		if _match.i_am_creator():
			_net.broadcast(TAG_PHASE, _match.serialize_phase())
		_match.clear_phase_dirty()                     # non-creators keep their phase from the creator
	for e in _match.drain_events():
		_net.broadcast(TAG_EVENT, e)                    # reliable, every tick
	for c in _match.drain_claims():
		_net.send(c["to"], TAG_HIT, c["claim"])         # addressed to the victim's owner
	if now_ms - _last_snapshot_at >= _snapshot_interval:  # snapshots throttled
		_last_snapshot_at = now_ms
		_net.broadcast(TAG_SNAPSHOT, _match.serialize_snapshot())
	if _match.has_method("serialize_digest") and now_ms - _last_digest_at >= NetDigest.INTERVAL_S * MS_PER_S:
		_last_digest_at = now_ms
		_net.broadcast(TAG_DIGEST, _match.serialize_digest())

func dispose() -> void:
	_net.leave()
