class_name ModelNames
## "Hardware model" names (RA9, T-2000, RTX4080, AX12S) — port of web names.ts, same random calls in the same order:
## prefix, digit count, digits, dash roll, then the suffix on the joined form. Used for the first-run profile name and
## for every bot added to a match.

const PREFIXES := [
	"RA", "RT", "RTX", "GTX", "MX", "ZX", "XJ", "HK", "AX", "RX", "VX", "NX",
	"TK", "DRX", "KR", "SR", "TX", "GX", "JX", "BX", "CX", "DX", "PX", "ZR",
	"QL", "OR", "KV", "LR", "MK", "ARC", "EX", "OX", "T", "K", "X", "V", "Z",
]
const SUFFIXES := ["", "", "", "", "", "X", "S", "A", "R", "Z"]   # empty entries: the suffix is often absent
const MIN_DIGITS := 1
const MAX_DIGITS := 4
const DASH_CHANCE := 0.3
const DECIMAL_BASE := 10
const DASH := "-"
const PATTERN := "^[A-Z]{1,3}-?\\d{1,4}[A-Z]?$"   # web MODEL_NAME_RE

## A new model name from `rng` (a Callable returning floats in [0, 1)).
static func generate(rng: Callable) -> String:
	var prefix: String = _pick(PREFIXES, rng)
	var tail := _numeric_tail(MIN_DIGITS + floori(rng.call() * (MAX_DIGITS - MIN_DIGITS + 1)), rng)
	var dashed: bool = rng.call() < DASH_CHANCE
	var suffix: String = "" if dashed else _pick(SUFFIXES, rng)
	return "%s%s%s%s" % [prefix, DASH if dashed else "", tail, suffix]

## A bot's name: the host's requested name trimmed, else a generated one (web addBot).
static func bot_name(requested: String, rng: Callable) -> String:
	var trimmed := requested.strip_edges()
	return trimmed if trimmed != "" else generate(rng)

static func is_model_name(name: String) -> bool:
	var regex := RegEx.create_from_string(PATTERN)
	return regex.search(name) != null

static func _numeric_tail(count: int, rng: Callable) -> String:
	var s := str(1 + floori(rng.call() * (DECIMAL_BASE - 1)))   # first digit 1..9
	for i in range(1, count):
		s += str(floori(rng.call() * DECIMAL_BASE))
	return s

static func _pick(items: Array, rng: Callable):
	return items[floori(rng.call() * items.size())]
