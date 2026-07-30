class_name LoopbackNet extends RefCounted
## In-process transport for tests: linked endpoints, synchronous delivery. Ported from LoopbackNet.ts.
## Implements the INet contract: broadcast/send by tag, on(tag), peers, presence.

var self_id: String
var _links: Array = []          # Array[LoopbackNet]
var _handlers := {}             # tag -> Array[Callable]
var _leave_cbs: Array = []

func _init(id: String) -> void:
	self_id = id

func link(peer) -> void:
	if not _links.has(peer):
		_links.append(peer)

func broadcast(tag: String, payload) -> void:
	for p in _links:
		p._deliver(tag, payload, self_id)

func send(peer_id: String, tag: String, payload) -> void:
	for p in _links:
		if p.self_id == peer_id:
			p._deliver(tag, payload, self_id)
			return

func _deliver(tag: String, payload, from: String) -> void:
	for cb in _handlers.get(tag, []):
		cb.call(payload, from)

func on(tag: String, cb: Callable) -> void:
	var list: Array = _handlers.get(tag, [])
	list.append(cb)
	_handlers[tag] = list

func on_peer_join(cb: Callable) -> void:
	for p in _links:
		cb.call(p.self_id)

func on_peer_leave(cb: Callable) -> void:
	_leave_cbs.append(cb)

func trigger_leave(peer_id := "") -> void:
	var ids: Array = [peer_id] if peer_id != "" else _links.map(func(p): return p.self_id)
	for id in ids:
		for cb in _leave_cbs:
			cb.call(id)

func peers() -> Array:
	return _links.map(func(p): return p.self_id)

func leave() -> void:
	_links.clear()
	_handlers.clear()

static func create_loopback_pair(id_a := "host", id_b := "client") -> Array:
	var a := LoopbackNet.new(id_a)
	var b := LoopbackNet.new(id_b)
	a.link(b)
	b.link(a)
	return [a, b]

static func create_loopback_hub(ids: Array) -> Array:
	var nets := []
	for id in ids:
		nets.append(LoopbackNet.new(id))
	for a in nets:
		for b in nets:
			if a != b:
				a.link(b)
	return nets
