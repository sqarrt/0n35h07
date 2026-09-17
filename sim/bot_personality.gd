class_name BotPersonality extends RefCounted
## Bot personality (11 traits) deterministic from a name. Ported from web botPersonality.ts.

const SKILL_CEILING_RATIO := 3.99
const FLAVOR := 0.08   # fraction of the range: random "character" around the skill-derived center

# anchors: [weak (skill=0), strong (skill=1)]
const HIT_CHANCE := [0.40, 0.798]
const FIRE_INTERVAL := [2800.0, 1400.0]
const REACTION_MS := [320.0, 70.0]
const DODGE_SKILL := [0.05, 0.95]
const DASH_RATE := [0.03, 0.30]
const JUMPINESS := [0.05, 0.45]
const STRAFE_FLIP := [2000.0, 600.0]
const GRAZE_MARGIN := [0.90, 0.15]
const BAIT_SKILL := [0.05, 0.90]
const EVADE_SKILL := [0.10, 0.95]

var skill := 0.0
var hit_chance := 0.0
var fire_interval_ms := 0.0
var reaction_ms := 0.0
var dodge_skill := 0.0
var dash_rate := 0.0
var jumpiness := 0.0
var strafe_flip_ms := 0.0
var graze_margin := 0.0
var bait_skill := 0.0
var evade_skill := 0.0

static func _lerp_anchor(a: Array, s: float) -> float:
	return a[0] + (a[1] - a[0]) * s

static func bot_skill(name: String) -> float:
	return SeededRng.new(name).next()

## Offensive strength (hits/sec) at skill s — for the ceiling invariant / tests.
static func offense_at(s: float) -> float:
	return _lerp_anchor(HIT_CHANCE, s) / (_lerp_anchor(FIRE_INTERVAL, s) / 1000.0)

static func from_name(name: String) -> BotPersonality:
	var s := bot_skill(name)
	var flav := SeededRng.new(name + ":flavor")
	var p := BotPersonality.new()
	p.skill = s
	# center = lerp(anchor, clamp01(s +/- jitter)); one flavor draw per trait, in this exact order.
	p.hit_chance = _lerp_anchor(HIT_CHANCE, clampf(s + (flav.next() - 0.5) * 2.0 * FLAVOR, 0.0, 1.0))
	p.fire_interval_ms = _lerp_anchor(FIRE_INTERVAL, clampf(s + (flav.next() - 0.5) * 2.0 * FLAVOR, 0.0, 1.0))
	p.reaction_ms = _lerp_anchor(REACTION_MS, clampf(s + (flav.next() - 0.5) * 2.0 * FLAVOR, 0.0, 1.0))
	p.dodge_skill = _lerp_anchor(DODGE_SKILL, clampf(s + (flav.next() - 0.5) * 2.0 * FLAVOR, 0.0, 1.0))
	p.dash_rate = _lerp_anchor(DASH_RATE, clampf(s + (flav.next() - 0.5) * 2.0 * FLAVOR, 0.0, 1.0))
	p.jumpiness = _lerp_anchor(JUMPINESS, clampf(s + (flav.next() - 0.5) * 2.0 * FLAVOR, 0.0, 1.0))
	p.strafe_flip_ms = _lerp_anchor(STRAFE_FLIP, clampf(s + (flav.next() - 0.5) * 2.0 * FLAVOR, 0.0, 1.0))
	p.graze_margin = _lerp_anchor(GRAZE_MARGIN, clampf(s + (flav.next() - 0.5) * 2.0 * FLAVOR, 0.0, 1.0))
	p.bait_skill = _lerp_anchor(BAIT_SKILL, clampf(s + (flav.next() - 0.5) * 2.0 * FLAVOR, 0.0, 1.0))
	p.evade_skill = _lerp_anchor(EVADE_SKILL, clampf(s + (flav.next() - 0.5) * 2.0 * FLAVOR, 0.0, 1.0))
	return p
