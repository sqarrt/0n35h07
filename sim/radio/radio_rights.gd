class_name RadioRights extends RefCounted
## web App's radio entitlement state (App.tsx radioOwned / radioResolved / bumpTrial): whether the Steam DLC is owned
## — first the profile's cached answer, so an owner sees no trial strip flash, then Steam's — and the free daily
## trial kept in the profile, counted per generated track and per library save. The profile is passed in: it is the
## game's live Dictionary and may be replaced by a reload.

signal changed

const KEY_OWNED := "radioDlcOwned"
const KEY_TRIAL := "radioTrial"

var owned := false
var resolved := false                           # ownership known (cached or from Steam)
var dev_unlimited := false

func _init(profile: Dictionary, dev := false) -> void:
	var cached = profile.get(KEY_OWNED)
	owned = cached if cached is bool else false
	resolved = cached is bool
	dev_unlimited = dev

## What today's trial allows (RadioEntitlement.entitlement_for).
func entitlement(profile: Dictionary, today: String) -> Dictionary:
	return RadioEntitlement.entitlement_for(owned, dev_unlimited,
		RadioEntitlement.roll_trial(profile.get(KEY_TRIAL), today))

## Steam's answer at warm-up: ownership settles and is cached in the profile.
func resolve(profile: Dictionary, is_owned: bool) -> void:
	var was_resolved := resolved
	resolved = true
	_set_owned(profile, is_owned, not was_resolved)

## Steam's answer after the store may have sold the DLC (overlay closed, window focused): no resolving.
func recheck(profile: Dictionary, is_owned: bool) -> void:
	_set_owned(profile, is_owned, false)

## A new live track began (web onGenerated → bumpTrial('gen')).
func note_generated(profile: Dictionary, today: String) -> void:
	profile[KEY_TRIAL] = RadioEntitlement.consume_gen(_trial(profile, today), today)
	changed.emit()

## A track went into the library (web onSaveTrack → bumpTrial('save')).
func note_saved(profile: Dictionary, today: String) -> void:
	profile[KEY_TRIAL] = RadioEntitlement.consume_save(_trial(profile, today), today)
	changed.emit()

## The player's free-trial strip {gens_left, saves_left}, or {} when unlimited or ownership is not known yet.
func trial_strip(profile: Dictionary, today: String) -> Dictionary:
	var allowed := entitlement(profile, today)
	if allowed["unlimited"] or not resolved:
		return {}
	return {"gens_left": int(allowed["gens_left"]), "saves_left": int(allowed["saves_left"])}

## The "Unlock Radio" offer (web onUnlock): on the trial only.
func can_unlock() -> bool:
	return not (owned or dev_unlimited)

func _set_owned(profile: Dictionary, is_owned: bool, force_changed: bool) -> void:
	var differs := owned != is_owned
	owned = is_owned
	profile[KEY_OWNED] = is_owned
	if differs or force_changed:
		changed.emit()

func _trial(profile: Dictionary, today: String) -> Dictionary:
	var stored = profile.get(KEY_TRIAL)
	return stored if stored is Dictionary else RadioEntitlement.empty_trial(today)
