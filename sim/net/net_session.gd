class_name NetSession extends RefCounted
## Symmetric mesh orchestrator over the transport (INet): every peer runs the SAME session —
## broadcasts snapshots of its owned players (throttled), applies peers' snapshots. Ported from NetSession.ts.

var _net
var _match
var _last_snapshot_at := -1000000.0
var _snapshot_interval := 1000.0 / NetConst.NET_SNAPSHOT_HZ

func _init(net, match_obj) -> void:
	_net = net
	_match = match_obj
	_net.on("snapshot", func(payload, from): _match.apply_peer_snapshot(from, payload))
	_net.on("event", func(payload, from): _match.apply_peer_event(from, payload))

## Send outgoing data after the simulation step (now in ms).
func after_update(now_ms: float) -> void:
	for e in _match.drain_events():
		_net.broadcast("event", e)                       # reliable, every tick
	if now_ms - _last_snapshot_at >= _snapshot_interval:  # snapshots throttled
		_last_snapshot_at = now_ms
		_net.broadcast("snapshot", _match.serialize_snapshot())

func dispose() -> void:
	_net.leave()
