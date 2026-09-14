class_name RoomSession extends RoomModel
## Room handshake on seats — port of web net/RoomSession: the room's seat rules on a transport (INet: LoopbackNet in
## tests, SteamNet in the game). The lobby creator hosts and sits on seat 0: HELLO seats a guest on the first free seat,
## and after every change each guest gets an ASSIGN (its seat, the roster, the resolved map and duration, readiness, the
## mode, who owns which player and the music seed); READY and SETSLOT come from guests; once every seat is ready START
## goes out (duration, map, owners, FFA start positions). A guest says HELLO every 0.4 s until its ASSIGN arrives,
## follows the creator's room, asks for readiness and seat moves, and closes when the creator leaves or the handshake
## times out.

signal closed                                   # guest: the creator left / the handshake timed out (web onClosed)

const ROLE_HOST := "host"
const ROLE_CLIENT := "client"
const TAG_HELLO := "hello"
const TAG_ASSIGN := "assign"
const TAG_START := "start"
const TAG_READY := "ready"
const TAG_SET_SLOT := "setSlot"
const HELLO_RETRY_S := 0.4                      # web HELLO_RETRY_MS
const MS_PER_MIN := 60000.0
const UNASSIGNED := -1
const GUEST_NAME := "Opponent"                  # web: a HELLO without a name
const HELLO_KEYS := ["name", "primaryColor", "reserveColor", "ballModel", "windupStyle", "respawnStyle", "dashStyle",
	"shieldStyle", "ballArt"]

var net
var role := ROLE_HOST
var music_seed := ""                            # web seed: shared with every peer in ASSIGN
var found_host := true                         # guest: the transport found a peer

var _profile: Dictionary
var _peer_by_slot := {}                         # creator: seat -> the guest's transport peer
var _owners := {}                               # guest: the owner map from the last ASSIGN
var _host_peer := ""                            # guest: the creator's peer (the ASSIGN sender)
var _hello_left := 0.0
var _timeout_left := 0.0
var _closed := false

## `transport`: the INet; `session_role`: ROLE_HOST for the lobby creator; `code`: the room code seeding the match
## music (a random one when empty); `maps` / `durations`: this side's selection (web sel — the creator's opening pick, a
## guest's wishes in its first HELLO; empty: the defaults).
func _init(transport, session_role: String, profile: Dictionary, rng: Callable, code := "", maps: Array = [],
		durations: Array = []) -> void:
	super(profile, rng)
	_take_selection(maps, durations)
	net = transport
	role = session_role
	_profile = profile
	if role == ROLE_HOST:
		music_seed = code.strip_edges() if code.strip_edges() != "" else RoomCode.random(rng)
		net.on(TAG_HELLO, _on_hello)
		net.on(TAG_READY, _on_ready)
		net.on(TAG_SET_SLOT, _on_set_slot)
		net.on_peer_leave(_on_guest_left)
		return
	local_player_id = UNASSIGNED
	connected = false
	found_host = not net.peers().is_empty()
	net.on(TAG_ASSIGN, _on_assign)
	net.on(TAG_START, _on_start)
	net.on_peer_leave(_on_peer_left)
	net.on_peer_join(_on_host_found)
	_say_hello()
	_hello_left = HELLO_RETRY_S
	_timeout_left = float(profile.get("connectTimeoutSec", 0))

func is_host() -> bool:
	return role == ROLE_HOST

## Who simulates each player: a guest's seat — its peer; the creator's seat and every bot — the creator.
func owners() -> Dictionary:
	if not is_host():
		return _owners
	var out := {}
	for entry in occupied():
		out[entry["id"]] = _peer_by_slot.get(entry["id"], net.self_id)
	return out

## Guest handshake clock: HELLO again every 0.4 s until assigned; close once the profile's connect timeout passes.
func tick(delta: float) -> void:
	if is_host() or connected or _closed:
		return
	_hello_left -= delta
	if _hello_left <= 0.0:
		_hello_left += HELLO_RETRY_S
		_say_hello()
	if _timeout_left > 0.0:
		_timeout_left -= delta
		if _timeout_left <= 0.0:
			_close()

## Guest: ask the creator for a free seat (a 2v2 team change).
func request_slot(slot: int) -> void:
	if not is_host() and not _started:
		net.broadcast(TAG_SET_SLOT, {"slot": slot})

func dispose() -> void:
	_closed = true
	net.leave()

# --- the creator's rules only ---

func set_mode(value: String) -> void:
	if is_host():
		super.set_mode(value)

func add_bot(slot: int, difficulty := DEFAULT_DIFFICULTY, bot_name := "") -> void:
	if is_host():
		super.add_bot(slot, difficulty, bot_name)

func remove_bot(slot: int) -> void:
	if is_host():
		super.remove_bot(slot)

func set_bot_difficulty(slot: int, difficulty: String) -> void:
	if is_host():
		super.set_bot_difficulty(slot, difficulty)

func set_bot_name(slot: int, bot_name: String) -> void:
	if is_host():
		super.set_bot_name(slot, bot_name)

## A guest keeps its wish locally; it ships in the next HELLO.
func set_map(ids: Array) -> void:
	if is_host():
		super.set_map(ids)
	elif not ids.is_empty():
		_take_selection(ids, [])
		changed.emit()

func set_duration(minutes: Array) -> void:
	if is_host():
		super.set_duration(minutes)
	elif not minutes.is_empty():
		_take_selection([], minutes)
		changed.emit()

func set_local_ready(ready: bool) -> void:
	if is_host():
		super.set_local_ready(ready)
	else:
		net.broadcast(TAG_READY, {"ready": ready})

# --- RoomModel hooks ---

func _publish() -> void:
	if is_host():
		for peer in _peer_by_slot.values():
			_send_assign(peer)

func _announce_start(setup: Dictionary) -> void:
	var spawns := _ffa_spawns() if mode == GameModes.WAR else []
	var owner_map := owners()
	net.broadcast(TAG_START, {"durationMs": duration_min * MS_PER_MIN, "mapId": map_id, "spawns": spawns,
		"owners": owner_map})
	_add_network_facts(setup, spawns, owner_map)

func _seats_compacted(old_ids: Array) -> void:
	var peers := {}
	for i in old_ids.size():
		if _peer_by_slot.has(old_ids[i]):
			peers[i] = _peer_by_slot[old_ids[i]]
	_peer_by_slot = peers

func _seat_moved(from_slot: int, to_slot: int) -> void:
	if _peer_by_slot.has(from_slot):
		_peer_by_slot[to_slot] = _peer_by_slot[from_slot]
		_peer_by_slot.erase(from_slot)

# --- creator ---

func _on_hello(hello: Dictionary, from: String) -> void:
	if _slot_of(from) >= 0:
		_send_assign(from)                      # a retry: the first ASSIGN may have been lost
		return
	var slot := slots.find(null)
	if slot < 0:
		return                                  # every seat taken: nobody is evicted
	_peer_by_slot[slot] = from                  # mapped before the room publishes, so the guest gets its ASSIGN
	seat_guest(_guest_entry(hello), _array_or(hello.get("desiredMap"), map_sel),
		_array_or(hello.get("desiredDuration"), duration_sel))

func _on_ready(message: Dictionary, from: String) -> void:
	var slot := _slot_of(from)
	if slot >= 0:
		set_ready(slot, bool(message.get("ready", false)))

func _on_set_slot(message: Dictionary, from: String) -> void:
	var slot := _slot_of(from)
	if slot >= 0:
		move_seat(slot, int(message.get("slot", UNASSIGNED)))

func _on_guest_left(peer: String) -> void:
	var slot := _slot_of(peer)
	if slot < 0:
		return
	_peer_by_slot.erase(slot)
	free_seat(slot)

func _send_assign(peer: String) -> void:
	var your_id := _slot_of(peer)
	if your_id < 0:
		return
	net.send(peer, TAG_ASSIGN, {"yourId": your_id, "roster": roster(), "durationMin": duration_min, "mapId": map_id,
		"ready": ready_ids(), "mode": mode, "owners": owners(), "seed": music_seed})

## web onHello: the guest's name (or "Opponent") and look, the web defaults for what it didn't send.
func _guest_entry(hello: Dictionary) -> Dictionary:
	var guest_name := String(hello.get("name", "")).strip_edges()
	var primary := String(hello.get("primaryColor", AppearanceConst.FALLBACK_TEXT_COLOR))
	var look := {
		"name": guest_name if guest_name != "" else GUEST_NAME,
		"primaryColor": primary,
		"reserveColor": String(hello.get("reserveColor", primary)),
		"ballModel": hello.get("ballModel", AppearanceConst.BALL_MODELS[0]),
		"windupStyle": hello.get("windupStyle", AppearanceConst.WINDUP_STYLES[0]),
		"respawnStyle": hello.get("respawnStyle", AppearanceConst.RESPAWN_STYLES[0]),
		"dashStyle": hello.get("dashStyle", AppearanceConst.DASH_STYLES[0]),
		"shieldStyle": hello.get("shieldStyle", AppearanceConst.SHIELD_STYLES[0]),
	}
	if hello.has("ballArt"):
		look["ballArt"] = hello["ballArt"]
	return Roster.human_entry(UNASSIGNED, look)

## web genFfaSpawns: the creator rolls the start positions once and ships them, so every peer places the same.
func _ffa_spawns() -> Array:
	var map_spawns := Spawns.from_raw(MapFiles.read_json(MapCatalog.raw_path(map_id)))
	var positions := Spawns.gen_ffa_spawns(occupied().size(), (map_spawns[0] as Vector3).y, _rng)
	return positions.map(func(position: Vector3) -> Array: return [position.x, position.y, position.z])

func _slot_of(peer: String) -> int:
	for slot in _peer_by_slot:
		if _peer_by_slot[slot] == peer:
			return slot
	return UNASSIGNED

# --- guest ---

func _say_hello() -> void:
	if local_player_id != UNASSIGNED:
		return
	var hello := {"desiredMap": map_sel, "desiredDuration": duration_sel}
	for key in HELLO_KEYS:
		if _profile.has(key):
			hello[key] = _profile[key]
	net.broadcast(TAG_HELLO, hello)

func _on_host_found(_peer: String) -> void:
	found_host = true
	changed.emit()
	_say_hello()

func _on_assign(assign: Dictionary, from: String) -> void:
	_host_peer = from
	connected = true
	found_host = true
	local_player_id = int(assign["yourId"])
	music_seed = String(assign.get("seed", ""))
	_owners = _int_keys(assign.get("owners", {}))
	apply_room(String(assign["mode"]), assign["roster"], String(assign["mapId"]), int(assign["durationMin"]),
		assign.get("ready", []))

func _on_start(start: Dictionary, _from: String) -> void:
	_started = true
	map_id = String(start["mapId"])
	duration_min = roundi(float(start["durationMs"]) / MS_PER_MIN)
	var setup := match_setup()
	_add_network_facts(setup, start.get("spawns", []), _int_keys(start.get("owners", {})))
	started.emit(setup)

## Before the ASSIGN any departure counts; after it only the creator's.
func _on_peer_left(peer: String) -> void:
	if _host_peer == "" or peer == _host_peer:
		_close()

func _close() -> void:
	if _started or _closed:
		return
	_closed = true
	closed.emit()

# --- shared ---

## What a peer needs to run the match: owners, FFA spawns, its own player id, the music seed and its peer id.
func _add_network_facts(setup: Dictionary, spawns: Array, owner_map: Dictionary) -> void:
	setup["owners"] = owner_map
	setup["spawns"] = spawns
	setup["local_id"] = local_player_id
	setup["seed"] = music_seed
	setup["self_peer"] = net.self_id

## A wire dictionary's player ids as ints (JSON keys arrive as strings).
static func _int_keys(source: Dictionary) -> Dictionary:
	var out := {}
	for key in source:
		out[int(key)] = source[key]
	return out

static func _array_or(value, fallback: Array) -> Array:
	return value if value is Array else fallback
