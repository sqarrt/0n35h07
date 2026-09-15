class_name Mulberry32 extends RefCounted
## mulberry32 — the small seeded random the web parity hooks use (web RadioVisualizer's pinned field): JavaScript's
## 32-bit integer arithmetic (Math.imul, >>>) over unsigned values held in 64-bit ints. next() is in [0, 1).

const MASK := 0xFFFFFFFF
const HALF_BITS := 16
const HALF_MASK := 0xFFFF
const INCREMENT := 0x6D2B79F5
const SHIFT_A := 15
const SHIFT_B := 7
const SHIFT_C := 14
const MIX_B := 61
const RANGE := 4294967296.0

var _state := 0

func _init(seed: int) -> void:
	_state = seed & MASK

func next() -> float:
	_state = (_state + INCREMENT) & MASK
	var t := _imul(_state ^ (_state >> SHIFT_A), 1 | _state)
	t = ((t + _imul(t ^ (t >> SHIFT_B), MIX_B | t)) & MASK) ^ t
	return float(t ^ (t >> SHIFT_C)) / RANGE

## Math.imul on unsigned 32-bit values: the low 32 bits of the product, split so no step overflows 64 bits.
static func _imul(a: int, b: int) -> int:
	var low := (a & HALF_MASK) * b
	var high := (((a >> HALF_BITS) & HALF_MASK) * b) & HALF_MASK
	return (low + (high << HALF_BITS)) & MASK
