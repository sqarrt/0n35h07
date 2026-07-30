class_name InterpBuffer extends RefCounted
## Timestamped position buffer for rendering a remote entity in the PAST (entity interpolation).
## sample(render_time) returns the position between the two bracketing samples. Ported from InterpBuffer.ts.

var _buf: Array = []   # [{t, x, y, z, tick}]
var _capacity: int

func _init(capacity := 16) -> void:
	_capacity = capacity

func push(t: float, x: float, y: float, z: float, sender_tick := 0) -> void:
	_buf.append({"t": t, "x": x, "y": y, "z": z, "tick": sender_tick})
	if _buf.size() > _capacity:
		_buf.pop_front()

func latest():
	if _buf.is_empty():
		return null
	var s = _buf[-1]
	return Vector3(s.x, s.y, s.z)

## Position at render_time; null if empty. Clamps to oldest/newest outside the buffered range.
func sample(render_time: float):
	if _buf.is_empty():
		return null
	if render_time <= _buf[0].t:
		return Vector3(_buf[0].x, _buf[0].y, _buf[0].z)
	var last = _buf[-1]
	if render_time >= last.t:
		return Vector3(last.x, last.y, last.z)
	for i in range(1, _buf.size()):
		var b = _buf[i]
		if render_time <= b.t:
			var a = _buf[i - 1]
			var f: float = (render_time - float(a.t)) / (float(b.t) - float(a.t))
			return Vector3(a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f, a.z + (b.z - a.z) * f)
	return Vector3(last.x, last.y, last.z)
