class_name SeededRng extends RefCounted
## Deterministic RNG from a string seed (djb2 + mulberry32). Ported from web util/seededRng.ts.
## Same seed -> same sequence in [0,1).

const MASK32 := 0xffffffff

var _state: int

func _init(seed: String) -> void:
	_state = _djb2(seed)

static func _to_int32(x: int) -> int:
	x = x & MASK32
	if x >= 0x80000000:
		x -= 0x100000000
	return x

static func _imul(a: int, b: int) -> int:
	return (_to_int32(a) * _to_int32(b)) & MASK32

static func _djb2(s: String) -> int:
	var h := 5381
	for i in s.length():
		h = (_imul(h, 33) ^ s.unicode_at(i)) & MASK32
	return h

func next() -> float:
	_state = (_state + 0x6D2B79F5) & MASK32
	var t := _state
	t = _imul(t ^ (t >> 15), 1 | t) & MASK32
	var a := (t + _imul(t ^ (t >> 7), 61 | t)) & MASK32
	t = (a ^ t) & MASK32
	return float((t ^ (t >> 14)) & MASK32) / 4294967296.0
