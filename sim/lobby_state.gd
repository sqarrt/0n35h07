class_name LobbyState
## The Play screen's state from its room — port of web components/lobby/lobbyState (lobbyStateFrom) and the choices in
## screens/Lobby and components/lobby/Seats: the seats this side shows, the single action button, the seats a sent
## Steam invite is drawn onto, and BACK / LEAVE. A plain RoomModel is a room we host alone, a DraftRoom the screen before
## its session.

const ACTION_STOP := "stop"                    # searching: STOP
const ACTION_WAIT_FRIEND := "wait_friend"      # an invite is out: WAITING FOR A FRIEND… (disabled)
const ACTION_SEARCH := "search"                # a desktop Duel host with a free seat: SEARCH
const ACTION_WAIT_OTHERS := "wait_others"      # we are ready: WAITING (disabled)
const ACTION_READY := "ready"                  # READY (the host needs the start gate, a guest its ASSIGN)
const UNASSIGNED := -1

## Every seat for this side: {slot, entry (null: free), mine, ready, team}. A guest sees the others only once assigned
## (before that its placeholder host seat would read as a match with itself).
static func seats(room: RoomModel) -> Array:
	var out: Array = []
	var shown := room.seats_shown()
	var mine_id := room.local_player_id
	for slot in room.slots.size():
		var entry = room.slots[slot] if shown else null
		out.append({"slot": slot, "entry": entry,
			"mine": entry != null and mine_id != UNASSIGNED and int(entry["id"]) == mine_id,
			"ready": entry != null and room.is_ready(slot), "team": GameModes.team_of_slot(room.mode, slot)})
	return out

## web Lobby action: one button whose kind and enabled state follow the room.
static func action(room: RoomModel, searching: bool, invites_out: int, desktop: bool) -> Dictionary:
	if searching:
		return {"kind": ACTION_STOP, "enabled": true}
	if invites_out > 0:
		return {"kind": ACTION_WAIT_FRIEND, "enabled": false}
	var host := room.is_host()
	if desktop and host and room.mode == GameModes.DUEL and room.slots.has(null):
		return {"kind": ACTION_SEARCH, "enabled": true}
	var mine := room.local_player_id
	if mine != UNASSIGNED and room.is_ready(mine):
		return {"kind": ACTION_WAIT_OTHERS, "enabled": false}
	return {"kind": ACTION_READY, "enabled": room.can_start() if host else room.connected}

## web Seats inviteBySlot: the sent invites drawn onto the first free seats in order (seats are not reserved).
static func invite_seats(seat_views: Array, invites: Array) -> Dictionary:
	var out := {}
	var free: Array = seat_views.filter(func(seat: Dictionary) -> bool: return seat["entry"] == null)
	for i in mini(invites.size(), free.size()):
		out[free[i]["slot"]] = invites[i]
	return out

## web seatedPeerIds: an invited friend who sat down (its SteamID owns a seat) no longer waits.
static func still_pending(invites: Array, room: RoomModel) -> Array:
	if not room is RoomSession:
		return invites
	var seated: Array = (room as RoomSession).owners().values()
	return invites.filter(func(invite: Dictionary) -> bool: return not seated.has(invite["id"]))

## web Lobby: LEAVE once anyone other than us sits in the room, BACK otherwise.
static func others_seated(seat_views: Array) -> bool:
	return seat_views.any(func(seat: Dictionary) -> bool: return seat["entry"] != null and not seat["mine"])
