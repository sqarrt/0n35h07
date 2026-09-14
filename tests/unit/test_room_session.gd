extends GutTest
## RoomSession parity with web net/RoomSession on loopback transports: seating and ASSIGN, the start everywhere, the
## map resolved against the guest's wishes (HELLO retried once linked), seat moves and mode switches keeping each guest's
## peer, departures, the handshake timeout, FFA start positions, a full room and guests without the creator's rules.

const HOST := "host"
const GUEST := "guest"
const THIRD := "third"
const CODE := "ABCD"
const HOST_PROFILE := {"name": "HOST", "primaryColor": "#fa4", "reserveColor": "#4af"}
const GUEST_PROFILE := {"name": "GUEST", "primaryColor": "#4fa", "reserveColor": "#f4a", "connectTimeoutSec": 10}
const THIRD_PROFILE := {"name": "THIRD", "primaryColor": "#a4f", "reserveColor": "#ff4"}
const ROLL := 0.0
const WISHED_MAP := "os_pillars"
const ALL_MAPS := ["os_arena", "os_india", "os_pillars"]
const TIMEOUT_S := 10.0
const FFA_PLAYERS := 3

var _setups := {}

func before_each() -> void:
	_setups = {}

func _rng() -> Callable:
	return func() -> float: return ROLL

func _session(net, role: String, profile: Dictionary) -> RoomSession:
	var session := RoomSession.new(net, role, PlayerProfile.sanitize(profile, _rng()), _rng(),
		CODE if role == RoomSession.ROLE_HOST else "")
	session.started.connect(func(setup: Dictionary) -> void: _setups[net.self_id] = setup)
	return session

func _pair() -> Array:
	var nets := LoopbackNet.create_loopback_hub([HOST, GUEST])
	var host := _session(nets[0], RoomSession.ROLE_HOST, HOST_PROFILE)
	var guest := _session(nets[1], RoomSession.ROLE_CLIENT, GUEST_PROFILE)
	return [host, guest, nets]

func test_a_guest_takes_the_free_seat_and_follows_the_room() -> void:
	var made := _pair()
	var host: RoomSession = made[0]
	var guest: RoomSession = made[1]
	assert_true(guest.connected)
	assert_eq(guest.local_player_id, 1)
	assert_eq(host.slots[1]["name"], "GUEST")
	assert_eq(host.slots[1]["kind"], Roster.KIND_HUMAN)
	assert_eq(guest.slots[0]["name"], "HOST", "the creator's seat as published")
	assert_eq(guest.music_seed, CODE, "the room code seeds the shared music")
	assert_eq(host.owners(), {0: HOST, 1: GUEST})
	assert_eq(guest.owners(), host.owners())
	assert_false(host.is_ready(1), "a fresh guest is not ready")

func test_every_seat_ready_starts_the_match_on_every_peer() -> void:
	var made := _pair()
	var host: RoomSession = made[0]
	var guest: RoomSession = made[1]
	host.set_local_ready(true)
	assert_true(guest.is_ready(0), "readiness is published")
	assert_true(_setups.is_empty())
	guest.set_local_ready(true)
	assert_eq(_setups.size(), 2, "START reaches the guest")
	assert_eq(_setups[HOST]["map_id"], _setups[GUEST]["map_id"])
	assert_eq(_setups[GUEST]["owners"], {0: HOST, 1: GUEST})
	assert_eq(_setups[HOST]["local_id"], 0)
	assert_eq(_setups[GUEST]["local_id"], 1)
	assert_eq(_setups[GUEST]["seed"], CODE)
	assert_eq(_setups[GUEST]["self_peer"], GUEST)
	assert_eq((_setups[GUEST]["roster"] as Array).size(), 2)

func test_the_map_resolves_against_the_guests_wish() -> void:
	var host_net := LoopbackNet.new(HOST)
	var guest_net := LoopbackNet.new(GUEST)
	var host := _session(host_net, RoomSession.ROLE_HOST, HOST_PROFILE)
	host.set_map(ALL_MAPS)
	var guest := _session(guest_net, RoomSession.ROLE_CLIENT, GUEST_PROFILE)
	guest.set_map([WISHED_MAP])
	assert_false(guest.connected, "nobody to talk to yet")
	host_net.link(guest_net)
	guest_net.link(host_net)
	guest.tick(RoomSession.HELLO_RETRY_S)
	assert_true(guest.connected, "the HELLO retry found the creator")
	assert_eq(host.map_id, WISHED_MAP, "the only map both accept")
	assert_eq(guest.map_sel, [WISHED_MAP])

func test_seat_moves_and_mode_switches_keep_each_guests_peer() -> void:
	var made := _pair()
	var host: RoomSession = made[0]
	var guest: RoomSession = made[1]
	host.set_mode(GameModes.BATTLE)
	guest.request_slot(3)
	assert_null(host.slots[1])
	assert_eq(host.slots[3]["name"], "GUEST")
	assert_eq(guest.local_player_id, 3, "a new ASSIGN follows the move")
	host.set_mode(GameModes.DUEL)
	assert_eq(guest.local_player_id, 1, "compacted onto seat 1, still assigned")
	assert_eq(host.owners(), {0: HOST, 1: GUEST})

func test_departures() -> void:
	var made := _pair()
	var host: RoomSession = made[0]
	var guest: RoomSession = made[1]
	var nets: Array = made[2]
	watch_signals(guest)
	(nets[0] as LoopbackNet).trigger_leave(GUEST)
	assert_null(host.slots[1], "the guest's seat frees")
	(nets[1] as LoopbackNet).trigger_leave(HOST)
	assert_signal_emit_count(guest, "closed", 1, "the creator leaving closes the guest's session")

func test_the_handshake_times_out_once() -> void:
	var guest := _session(LoopbackNet.new(GUEST), RoomSession.ROLE_CLIENT, GUEST_PROFILE)
	watch_signals(guest)
	guest.tick(TIMEOUT_S - RoomSession.HELLO_RETRY_S)
	assert_signal_not_emitted(guest, "closed")
	guest.tick(RoomSession.HELLO_RETRY_S)
	guest.tick(RoomSession.HELLO_RETRY_S)
	assert_signal_emit_count(guest, "closed", 1)

func test_ffa_start_positions_are_shipped() -> void:
	var nets := LoopbackNet.create_loopback_hub([HOST, GUEST])
	var host := _session(nets[0], RoomSession.ROLE_HOST, HOST_PROFILE)
	host.set_mode(GameModes.WAR)
	host.add_bot(1)
	var guest := _session(nets[1], RoomSession.ROLE_CLIENT, GUEST_PROFILE)
	host.set_local_ready(true)
	guest.set_local_ready(true)
	var spawns: Array = _setups[GUEST]["spawns"]
	assert_eq(spawns.size(), FFA_PLAYERS)
	assert_eq(spawns, _setups[HOST]["spawns"], "the same positions on every peer")
	assert_eq(_setups[GUEST]["owners"], {0: HOST, 1: HOST, 2: GUEST}, "bots belong to the creator")

func test_a_full_room_turns_a_guest_away() -> void:
	var nets := LoopbackNet.create_loopback_hub([HOST, GUEST])
	var host := _session(nets[0], RoomSession.ROLE_HOST, HOST_PROFILE)
	host.add_bot(1)
	var guest := _session(nets[1], RoomSession.ROLE_CLIENT, GUEST_PROFILE)
	assert_false(guest.connected)
	assert_eq(host.slots[1]["kind"], Roster.KIND_BOT, "no eviction")

func test_guests_do_not_run_the_rules() -> void:
	var nets := LoopbackNet.create_loopback_hub([HOST, GUEST, THIRD])
	var host := _session(nets[0], RoomSession.ROLE_HOST, HOST_PROFILE)
	host.set_mode(GameModes.WAR)
	var guest := _session(nets[1], RoomSession.ROLE_CLIENT, GUEST_PROFILE)
	var third := _session(nets[2], RoomSession.ROLE_CLIENT, THIRD_PROFILE)
	guest.add_bot(3)
	guest.set_mode(GameModes.DUEL)
	assert_null(host.slots[3])
	assert_eq(host.mode, GameModes.WAR)
	assert_eq(third.local_player_id, 2)
	assert_eq(guest.slots[2]["name"], "THIRD", "every guest follows the whole room")
