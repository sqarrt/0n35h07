class_name RadioEntitlement
## The Radio's free daily trial — port of web src/radio/entitlement.ts: a paid Steam DLC (or a dev run) unlocks it
## without limit, otherwise every local day allows FREE_GENS_PER_DAY new live tracks and FREE_SAVES_PER_DAY
## player→library saves. Pure: the caller passes today's key. A trial is the profile's {day, gens, saves}.

const FREE_GENS_PER_DAY := 10
const FREE_SAVES_PER_DAY := 5
const DAY := "day"
const GENS := "gens"
const SAVES := "saves"
const DAY_FORMAT := "%04d-%02d-%02d"

## The local calendar day of a Time date dictionary, e.g. "2026-06-28" (web todayKey).
static func today_key(date: Dictionary) -> String:
	return DAY_FORMAT % [date["year"], date["month"], date["day"]]

static func empty_trial(today: String) -> Dictionary:
	return {DAY: today, GENS: 0, SAVES: 0}

## The trial advanced to today: a new day resets the counters; the same day — or a clock wound back — keeps them.
static func roll_trial(trial: Variant, today: String) -> Dictionary:
	if not (trial is Dictionary) or today > String(trial[DAY]):
		return empty_trial(today)
	return trial

## What the trial allows now: {unlimited, gens_left, saves_left, can_generate, can_save} (INF left when unlimited).
static func entitlement_for(owned: bool, dev_unlimited: bool, trial: Dictionary) -> Dictionary:
	var unlimited := owned or dev_unlimited
	var gens_left := INF if unlimited else float(maxi(0, FREE_GENS_PER_DAY - int(trial[GENS])))
	var saves_left := INF if unlimited else float(maxi(0, FREE_SAVES_PER_DAY - int(trial[SAVES])))
	return {"unlimited": unlimited, "gens_left": gens_left, "saves_left": saves_left,
		"can_generate": gens_left > 0.0, "can_save": saves_left > 0.0}

## One more generation today (a new copy; the stored trial is untouched).
static func consume_gen(trial: Dictionary, today: String) -> Dictionary:
	return _consume(trial, today, GENS)

static func consume_save(trial: Dictionary, today: String) -> Dictionary:
	return _consume(trial, today, SAVES)

static func _consume(trial: Dictionary, today: String, counter: String) -> Dictionary:
	var rolled := roll_trial(trial, today).duplicate()
	rolled[counter] = int(rolled[counter]) + 1
	return rolled
