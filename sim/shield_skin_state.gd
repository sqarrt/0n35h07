class_name ShieldSkinState extends RefCounted
## Shield skin timing — ports of web DomeShieldFx (fill + wireframe pulsing together), HexShieldFx (36 hexagon tiles on a
## Fibonacci sphere flashing in a top-to-bottom wave on activation, then a smooth shimmer) and CrystalShieldFx
## (icosahedron shell whose lit face hops every 140 ms). The shield colour is always #4af.

const COLOR := Color("#4af")
const DOME := "dome"
const HEX := "hex"
const CRYSTAL := "crystal"
const DOME_FILL_RADIUS := 0.75
const DOME_FILL_SEGMENTS := 16
const DOME_WIRE_RADIUS := 0.76
const DOME_WIRE_SEGMENTS_W := 12
const DOME_WIRE_SEGMENTS_H := 8
const DOME_PULSE_RATE := 0.007             # web Date.now() multiplier
const DOME_FILL_BASE := 0.08
const DOME_FILL_AMP := 0.1
const DOME_WIRE_BASE := 0.3
const DOME_WIRE_AMP := 0.3
const HEX_RADIUS := 0.78
const HEX_TILES := 36
const HEX_TILE_RADIUS := 0.22
const HEX_TILE_SIDES := 6
const HEX_BASE_OPACITY := 0.18
const HEX_FLASH_OPACITY := 0.85
const HEX_WAVE_MS := 350.0
const HEX_FLASH_MS := 200.0
const HEX_SHIMMER_AMP := 0.06
const HEX_SHIMMER_RATE := 0.004
const HEX_PHASE_STEP := 2.4
const CRYSTAL_RADIUS := 0.78
const CRYSTAL_FILL_OPACITY := 0.12
const CRYSTAL_EDGE_OPACITY := 0.5
const CRYSTAL_FACE_OPACITY := 0.4
const CRYSTAL_FLICKER_MS := 140.0
const CRYSTAL_FACE_SCALE := 1.01
const CRYSTAL_FACES := 20
const CRYSTAL_FACE_STEP := 7
const HALF := 0.5
const GOLDEN_ANGLE := PI * (3.0 - sqrt(5.0))

var style := DOME
var _time_ms := 0.0
var _was_active := false
var _active_ms := 0.0
var _crystal_clock := 0.0

func _init(skin_style := DOME) -> void:
	style = skin_style if skin_style in [HEX, CRYSTAL] else DOME

## web update(dt, active): time always runs for the dome pulse; hex restarts its wave on the activation edge; the
## crystal clock only runs while active.
func update(dt: float, active: bool) -> void:
	var ms := dt * SkinCurves.MS_PER_S
	_time_ms += ms
	if not active:
		_was_active = false
		return
	if not _was_active:
		_was_active = true
		_active_ms = 0.0
	_active_ms += ms
	_crystal_clock += ms

func dome_pulse() -> float:
	return HALF + HALF * sin(_time_ms * DOME_PULSE_RATE)

func dome_fill_opacity() -> float:
	return DOME_FILL_BASE + DOME_FILL_AMP * dome_pulse()

func dome_wire_opacity() -> float:
	return DOME_WIRE_BASE + DOME_WIRE_AMP * dome_pulse()

## Unit direction of hex tile `i` on the Fibonacci sphere (tile 0 at the top).
static func hex_tile_direction(i: int) -> Vector3:
	var y := 1.0 - 2.0 * (i + HALF) / HEX_TILES
	var r := sqrt(maxf(0.0, 1.0 - y * y))
	var a := i * GOLDEN_ANGLE
	return Vector3(cos(a) * r, y, sin(a) * r)

## ms from the activation to tile `i`'s flash (by latitude, top to bottom).
static func hex_tile_delay(i: int) -> float:
	return acos(clampf(hex_tile_direction(i).y, -1.0, 1.0)) / PI * HEX_WAVE_MS

func hex_tile_opacity(i: int) -> float:
	var flash_t := (_active_ms - hex_tile_delay(i)) / HEX_FLASH_MS
	var flash := 1.0 - flash_t if flash_t >= 0.0 and flash_t < 1.0 else 0.0
	var shimmer := HEX_SHIMMER_AMP * sin(_active_ms * HEX_SHIMMER_RATE + i * HEX_PHASE_STEP)
	return HEX_BASE_OPACITY + shimmer + (HEX_FLASH_OPACITY - HEX_BASE_OPACITY) * flash

func crystal_lit_face() -> int:
	return (floori(_crystal_clock / CRYSTAL_FLICKER_MS) * CRYSTAL_FACE_STEP) % CRYSTAL_FACES
