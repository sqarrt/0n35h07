class_name DraftRoom extends RoomModel
## The Play screen before its session exists — web lobbyStateFrom with no RoomView (a Steam lobby still forming, a quick
## match still searching): a Duel pair with me on my intended side (seat 0 hosting, seat 1 joining) and nobody else, no
## start; the map and time are this side's wishes (web draftSel). Seats, mode and readiness wait for the session.

const GUEST_SLOT := 1

var _hosting := true

## `hosting`: this side will create the lobby; `maps` / `durations`: the draft selection.
func _init(profile: Dictionary, rng: Callable, hosting: bool, maps: Array, durations: Array) -> void:
	super(profile, rng)
	_hosting = hosting
	connected = false
	if not hosting:
		slots[GUEST_SLOT] = Roster.human_entry(GUEST_SLOT, profile)
		slots[HOST_SLOT] = null
		local_player_id = GUEST_SLOT
	_keep_wish(maps, durations)

func is_host() -> bool:
	return _hosting

func seats_shown() -> bool:
	return true

func can_start() -> bool:
	return false

func set_mode(_value: String) -> void:
	pass

func add_bot(_slot: int, _difficulty := DEFAULT_DIFFICULTY, _bot_name := "") -> void:
	pass

func remove_bot(_slot: int) -> void:
	pass

func set_bot_difficulty(_slot: int, _difficulty: String) -> void:
	pass

func set_bot_name(_slot: int, _bot_name: String) -> void:
	pass

func set_local_ready(_is_ready: bool) -> void:
	pass

func set_map(ids: Array) -> void:
	if not ids.is_empty():
		_keep_wish(ids, duration_sel)
		changed.emit()

func set_duration(minutes: Array) -> void:
	if not minutes.is_empty():
		_keep_wish(map_sel, minutes)
		changed.emit()

func _keep_wish(maps: Array, durations: Array) -> void:
	map_sel = maps.duplicate()
	duration_sel = durations.duplicate()
	map_id = map_sel[0]
	duration_min = duration_sel[0]
