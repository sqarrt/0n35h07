class_name MusicRng extends RefCounted
## Deterministic music PRNG — port of web game/audio/rng.ts: FNV-1a string hash (room code -> seed) and mulberry32.
## JS 32-bit integer semantics (Math.imul, >>>, | 0) are reproduced on unsigned 32-bit values so every peer and the
## web reference compose the same music from the same seed.

const MASK := 0xFFFFFFFF
const FNV_OFFSET := 2166136261
const FNV_PRIME := 16777619
const MULBERRY_STEP := 0x6D2B79F5
const WORD := 4294967296.0                   # 2^32: uint32 -> [0, 1)
const HALF_BITS := 16
const LOW_HALF := 0xFFFF
const SHIFT_A := 15
const SHIFT_B := 7
const SHIFT_C := 14
const ODD_A := 1
const ODD_B := 61

var _state := 0

func _init(seed: int) -> void:
	_state = seed & MASK

## FNV-1a 32-bit over the UTF-16 code units of a string (JS charCodeAt).
static func hash_seed(text: String) -> int:
	var h := FNV_OFFSET
	var units := text.to_utf16_buffer()   # little-endian code units, no byte order mark
	for i in range(0, units.size(), 2):
		h = (h ^ (units[i] | (units[i + 1] << 8))) & MASK
		h = imul(h, FNV_PRIME)
	return h

## Math.imul on unsigned 32-bit inputs: the low 32 bits of the product, without overflowing int64.
static func imul(a: int, b: int) -> int:
	var ah := (a >> HALF_BITS) & LOW_HALF
	var al := a & LOW_HALF
	var bh := (b >> HALF_BITS) & LOW_HALF
	var bl := b & LOW_HALF
	return (al * bl + (((ah * bl + al * bh) & LOW_HALF) << HALF_BITS)) & MASK

## The next value in [0, 1) (web mulberry32's closure).
func next() -> float:
	_state = (_state + MULBERRY_STEP) & MASK
	var a := _state
	var t := imul(a ^ (a >> SHIFT_A), ODD_A | a)
	t = ((t + imul(t ^ (t >> SHIFT_B), ODD_B | t)) & MASK) ^ t
	return float((t ^ (t >> SHIFT_C)) & MASK) / WORD

## A Callable drawing from this generator (for code that takes `rng: Callable`). The Callable does not keep the
## generator alive: hold a reference to it for as long as the Callable is used.
func as_callable() -> Callable:
	return next
