class_name RoomModel extends RefCounted
## The room's seat rules — port of the web RoomSession host rules: the seats of the mode (roster entries or null, the
## lobby creator on seat 0), bots that are always ready (the name drives look and personality), guests seated on the
## first free seat, mode switches that compact the seated players and never evict anyone, the map / duration resolved
## as a random pick from what both sides accept, and the start as soon as every seat is ready and the gate holds.
## Alone it is the local host room; RoomSession puts it on a transport through the hooks below.

signal changed
signal started(setup: Dictionary)   # {mode, map_id, duration_min, roster, teams} (+ RoomSession's network facts)

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
var local_player_id := HOST_SLOT                            # this side's seat (a guest's arrives with its ASSIGN)
var connected := true                                       # a guest: its ASSIGN arrived

var _rng: Callable
var _ready_ids := {}
var _started := false

## `profile`: a sanitized PlayerProfile for the creator's seat; `rng`: 0..1 rolls for picks and bot names.
func _init(profile: Dictionary, rng: Callable) -> void:
	_rng = rng
	map_sel = [MapCatalog.MAP_IDS[0]]                        # web handlePlay: the first map, the first duration
	duration_sel = [DEFAULT_DURATION_MIN]
	map_id = map_sel[0]
	slots.resize(GameModes.slot_count(mode))
	slots[HOST_SLOT] = Roster.human_entry(HOST_SLOT, profile)

## This side created the room (a local room always did).
func is_host() -> bool:
	return true

## This side is shown who sits where (web: a guest sees the others only once assigned).
func seats_shown() -> bool:
	return is_host() or connected

func occupied() -> Array:
	return slots.filter(func(entry) -> bool: return entry != null)

## The match roster: every occupied seat (entry id = seat index).
func roster() -> Array:
	return occupied().map(func(entry: Dictionary) -> Dictionary: return entry.duplicate())

func is_ready(slot: int) -> bool:
	return _ready_ids.has(slot)

func ready_ids() -> Array:
	var ids := _ready_ids.keys()
	ids.sort()
	return ids

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
	var old_ids: Array = []
	for i in entries.size():
		var entry: Dictionary = entries[i].duplicate()
		old_ids.append(entry["id"])
		if _ready_ids.has(entry["id"]):
			ready[i] = true
		entry["id"] = i
		next[i] = entry
	mode = value
	slots = next
	_ready_ids = ready
	_seats_compacted(old_ids)
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
	resolve_against(map_sel, duration_sel)                   # a bot accepts anything
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

## A human guest takes the first free seat, not ready yet, and the selection resolves against the maps and durations
## it accepts; the seat, or -1 when every seat is taken (nobody is evicted).
func seat_guest(entry: Dictionary, maps: Array, durations: Array) -> int:
	var slot := slots.find(null)
	if slot < 0:
		return -1
	var seated := entry.duplicate()
	seated["id"] = slot
	slots[slot] = seated
	_ready_ids.erase(slot)
	resolve_against(maps, durations)
	_sync()
	return slot

## Empty a seat (its guest left).
func free_seat(slot: int) -> void:
	if slot < 0 or slot >= slots.size() or slots[slot] == null:
		return
	slots[slot] = null
	_ready_ids.erase(slot)
	_sync()

## Move a seated player onto a free seat (a 2v2 team change), readiness included; whether it moved.
func move_seat(from_slot: int, to_slot: int) -> bool:
	if to_slot < 0 or to_slot >= slots.size() or slots[to_slot] != null or from_slot < 0 \
			or from_slot >= slots.size() or slots[from_slot] == null:
		return false
	var entry: Dictionary = slots[from_slot].duplicate()
	entry["id"] = to_slot
	slots[to_slot] = entry
	slots[from_slot] = null
	if _ready_ids.has(from_slot):
		_ready_ids.erase(from_slot)
		_ready_ids[to_slot] = true
	_seat_moved(from_slot, to_slot)
	_sync()
	return true

func set_ready(slot: int, ready: bool) -> void:
	if ready:
		_ready_ids[slot] = true
	else:
		_ready_ids.erase(slot)
	_sync()

func set_local_ready(ready: bool) -> void:
	set_ready(HOST_SLOT, ready)

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

## web resolveMatchParams: a random pick from what both sides accept (the creator's selection when nothing overlaps),
## after which the selection shows just the pick.
func resolve_against(maps: Array, durations: Array) -> void:
	var common_maps := map_sel.filter(func(id) -> bool: return maps.has(id))
	var common_durations := duration_sel.filter(func(minutes) -> bool: return durations.has(minutes))
	map_id = _pick(common_maps if not common_maps.is_empty() else map_sel)
	duration_min = _pick(common_durations if not common_durations.is_empty() else duration_sel)
	map_sel = [map_id]
	duration_sel = [duration_min]

## Take the whole room as the creator published it (a guest's view): no rules run, no start.
func apply_room(room_mode: String, entries: Array, room_map_id: String, room_duration_min: int, ready: Array) -> void:
	mode = room_mode
	slots = []
	slots.resize(GameModes.slot_count(mode))
	for entry in entries:
		var id := int(entry["id"])
		if id >= 0 and id < slots.size():
			slots[id] = (entry as Dictionary).duplicate()
	map_id = room_map_id
	duration_min = room_duration_min
	map_sel = [map_id]
	duration_sel = [duration_min]
	_ready_ids = {}
	for id in ready:
		_ready_ids[int(id)] = true
	changed.emit()

## The match setup the start announces.
func match_setup() -> Dictionary:
	var entries := roster()
	var teams := {}
	for entry in entries:
		teams[entry["id"]] = GameModes.team_of_slot(mode, entry["id"])
	return {"mode": mode, "map_id": map_id, "duration_min": duration_min, "roster": entries, "teams": teams}

## Hook: the room changed and is about to tell its listeners (RoomSession publishes it to the guests first).
func _publish() -> void:
	pass

## Hook: the start is about to be announced (RoomSession sends it and adds the network facts to the setup).
func _announce_start(_setup: Dictionary) -> void:
	pass

## Hook: a mode switch compacted the seats; `old_ids[i]` sat where seat i is now.
func _seats_compacted(_old_ids: Array) -> void:
	pass

## Hook: a seated player moved between seats.
func _seat_moved(_from_slot: int, _to_slot: int) -> void:
	pass

func _is_bot(slot: int) -> bool:
	return slot >= 0 and slot < slots.size() and slots[slot] != null and slots[slot]["kind"] == Roster.KIND_BOT

func _pick(options: Array):
	return options[mini(floori(float(_rng.call()) * options.size()), options.size() - 1)]

func _sync() -> void:
	_publish()
	changed.emit()
	if _started or not can_start():
		return
	for entry in occupied():
		if not _ready_ids.has(entry["id"]):
			return
	_start()

func _start() -> void:
	_started = true
	var setup := match_setup()
	_announce_start(setup)
	started.emit(setup)
