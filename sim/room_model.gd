class_name RoomModel extends RefCounted
## Local host room — port of the web RoomSession host rules without the network: the seats of the mode (roster
## entries or null, the host on seat 0), bots that are always ready (the name drives look and personality), mode
## switches that compact the seated players and never evict anyone, the map / duration selection resolved by a random
## pick once a bot joins (a bot accepts anything), and the start as soon as every seat is ready and the gate holds.

signal changed
signal started(setup: Dictionary)   # {mode, map_id, duration_min, roster, teams}

const HOST_SLOT := 0
const DEFAULT_DIFFICULTY := "normal"                        # web BOT_DEFAULT_DIFFICULTY
const PASSIVE_DIFFICULTY := "passive"                       # the bot stands still (web BotController passive)
const DEFAULT_DURATION_MIN := MatchConst.LOBBY_DEFAULT_DURATION_MIN

var mode := GameModes.DUEL
var slots: Array = []
var map_sel: Array = []
var duration_sel: Array = []
var map_id := ""
var duration_min := DEFAULT_DURATION_MIN

var _rng: Callable
var _ready_ids := {}
var _started := false

## `profile`: a sanitized PlayerProfile for the host's seat; `rng`: 0..1 rolls for picks and bot names.
func _init(profile: Dictionary, rng: Callable) -> void:
	_rng = rng
	map_sel = [MapCatalog.MAP_IDS[0]]                        # web handlePlay: the first map, the first duration
	duration_sel = [DEFAULT_DURATION_MIN]
	map_id = map_sel[0]
	slots.resize(GameModes.slot_count(mode))
	slots[HOST_SLOT] = Roster.human_entry(HOST_SLOT, profile)

func occupied() -> Array:
	return slots.filter(func(entry) -> bool: return entry != null)

func is_ready(slot: int) -> bool:
	return _ready_ids.has(slot)

func is_started() -> bool:
	return _started

func can_start() -> bool:
	return GameModes.can_start_for(mode, occupied().size())

## Switch the preset; blocked while more players are seated than the mode offers.
func set_mode(value: String) -> void:
	if _started or value == mode:
		return
	var entries := occupied()
	if entries.size() > GameModes.slot_count(value):
		return
	var next: Array = []
	next.resize(GameModes.slot_count(value))
	var ready := {}
	for i in entries.size():
		var entry: Dictionary = entries[i].duplicate()
		if _ready_ids.has(entry["id"]):
			ready[i] = true
		entry["id"] = i
		next[i] = entry
	mode = value
	slots = next
	_ready_ids = ready
	_sync()

## Seat a bot on a free seat (no name: a generated model name).
func add_bot(slot: int, difficulty := DEFAULT_DIFFICULTY, bot_name := "") -> void:
	if _started or slot < 0 or slot >= slots.size() or slots[slot] != null:
		return
	var chosen := bot_name.strip_edges()
	if chosen == "":
		chosen = ModelNames.generate(_rng)
	slots[slot] = Roster.bot_entry(slot, chosen, difficulty)
	_ready_ids[slot] = true
	_resolve()
	_sync()

func remove_bot(slot: int) -> void:
	if not _is_bot(slot):
		return
	slots[slot] = null
	_ready_ids.erase(slot)
	_sync()

func set_bot_difficulty(slot: int, difficulty: String) -> void:
	if not _is_bot(slot) or slots[slot]["difficulty"] == difficulty:
		return
	slots[slot]["difficulty"] = difficulty
	_sync()

## Rename a bot (its look and personality follow); an empty name keeps the current bot.
func set_bot_name(slot: int, bot_name: String) -> void:
	var chosen := bot_name.strip_edges()
	if not _is_bot(slot) or chosen == "":
		return
	slots[slot] = Roster.bot_entry(slot, chosen, slots[slot]["difficulty"])
	_sync()

func set_map(ids: Array) -> void:
	if ids.is_empty():
		return
	map_sel = ids.duplicate()
	map_id = map_sel[0]
	_sync()

func set_duration(minutes: Array) -> void:
	if minutes.is_empty():
		return
	duration_sel = minutes.duplicate()
	duration_min = duration_sel[0]
	_sync()

func set_local_ready(ready: bool) -> void:
	if ready:
		_ready_ids[HOST_SLOT] = true
	else:
		_ready_ids.erase(HOST_SLOT)
	_sync()

func _is_bot(slot: int) -> bool:
	return slot >= 0 and slot < slots.size() and slots[slot] != null and slots[slot]["kind"] == Roster.KIND_BOT

## web resolveAgainst(ALL): a random pick from the host's selection, which then shows just the pick.
func _resolve() -> void:
	map_id = _pick(map_sel)
	duration_min = _pick(duration_sel)
	map_sel = [map_id]
	duration_sel = [duration_min]

func _pick(options: Array):
	return options[mini(floori(float(_rng.call()) * options.size()), options.size() - 1)]

func _sync() -> void:
	changed.emit()
	if _started or not can_start():
		return
	for entry in occupied():
		if not _ready_ids.has(entry["id"]):
			return
	_start()

func _start() -> void:
	_started = true
	var roster := occupied().map(func(entry: Dictionary) -> Dictionary: return entry.duplicate())
	var teams := {}
	for entry in roster:
		teams[entry["id"]] = GameModes.team_of_slot(mode, entry["id"])
	started.emit({"mode": mode, "map_id": map_id, "duration_min": duration_min, "roster": roster, "teams": teams})
