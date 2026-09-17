extends GutTest
## The Play screen's state (web lobbyStateFrom + Lobby / Seats choices): the action button in every state, what a guest
## sees before and after its ASSIGN, sent invites on the free seats and pruned once the friend sits, BACK / LEAVE.

const HOST := "host"
const GUEST := "guest"
const PROFILE := {"name": "HOST", "primaryColor": "#fa4", "reserveColor": "#4af"}
const GUEST_PROFILE := {"name": "GUEST", "primaryColor": "#4fa", "reserveColor": "#f4a"}
const INVITE := {"id": "76561190000000001", "name": "FRIEND"}
const DESKTOP := true
const BROWSER := false

func _rng() -> Callable:
	return func() -> float: return 0.0

func _host_room() -> RoomModel:
	return RoomModel.new(PlayerProfile.sanitize(PROFILE, _rng()), _rng())

func test_a_desktop_duel_host_searches_for_the_free_seat() -> void:
	var room := _host_room()
	assert_eq(LobbyState.action(room, false, 0, DESKTOP), {"kind": LobbyState.ACTION_SEARCH, "enabled": true})
	assert_eq(LobbyState.action(room, false, 0, BROWSER), {"kind": LobbyState.ACTION_READY, "enabled": false},
		"the browser build has no search: READY waits for the start gate")
	assert_eq(LobbyState.action(room, true, 0, DESKTOP), {"kind": LobbyState.ACTION_STOP, "enabled": true})
	assert_eq(LobbyState.action(room, false, 1, DESKTOP), {"kind": LobbyState.ACTION_WAIT_FRIEND, "enabled": false})

func test_a_full_room_is_ready_then_waits() -> void:
	var room := _host_room()
	room.add_bot(1)
	assert_eq(LobbyState.action(room, false, 0, DESKTOP), {"kind": LobbyState.ACTION_READY, "enabled": true})
	room.set_mode(GameModes.BATTLE)
	room.set_local_ready(true)   # two of four seats: no start yet
	assert_eq(LobbyState.action(room, false, 0, DESKTOP), {"kind": LobbyState.ACTION_WAIT_OTHERS, "enabled": false},
		"no SEARCH outside a Duel; once ready we wait")

func test_a_guest_sees_the_room_only_once_assigned() -> void:
	var guest_net := LoopbackNet.new(GUEST)
	var guest := RoomSession.new(guest_net, RoomSession.ROLE_CLIENT, PlayerProfile.sanitize(GUEST_PROFILE, _rng()), _rng())
	assert_true(LobbyState.seats(guest).all(func(seat: Dictionary) -> bool: return seat["entry"] == null))
	assert_eq(LobbyState.action(guest, false, 0, DESKTOP), {"kind": LobbyState.ACTION_READY, "enabled": false})
	var host_net := LoopbackNet.new(HOST)
	var host := RoomSession.new(host_net, RoomSession.ROLE_HOST, PlayerProfile.sanitize(PROFILE, _rng()), _rng())
	host_net.link(guest_net)
	guest_net.link(host_net)
	guest.tick(RoomSession.HELLO_RETRY_S)
	var seats := LobbyState.seats(guest)
	assert_eq(seats[0]["entry"]["name"], "HOST")
	assert_true(seats[1]["mine"])
	assert_false(seats[0]["mine"])
	assert_eq(LobbyState.action(guest, false, 0, DESKTOP), {"kind": LobbyState.ACTION_READY, "enabled": true},
		"a guest never searches")
	assert_true(LobbyState.others_seated(seats))
	assert_false(LobbyState.others_seated(LobbyState.seats(_host_room())), "alone: BACK")
	assert_eq(LobbyState.still_pending([{"id": HOST, "name": "H"}, INVITE], host), [INVITE],
		"a friend who sat down no longer waits")

func test_before_the_session_i_sit_on_my_intended_side() -> void:
	var profile := PlayerProfile.sanitize(PROFILE, _rng())
	var hosting := DraftRoom.new(profile, _rng(), true, ["os_arena"], [5])
	var seats := LobbyState.seats(hosting)
	assert_eq(seats.size(), 2, "a Duel pair")
	assert_true(seats[0]["mine"] and seats[0]["entry"]["name"] == "HOST", "hosting: seat 0")
	assert_null(seats[1]["entry"])
	assert_eq(LobbyState.action(hosting, false, 0, DESKTOP), {"kind": LobbyState.ACTION_SEARCH, "enabled": true},
		"web: SEARCH while the Steam lobby forms")
	assert_eq([hosting.map_sel, hosting.duration_sel], [["os_arena"], [5]], "the draft selection")
	var joining := DraftRoom.new(profile, _rng(), false, ["os_arena"], [5])
	seats = LobbyState.seats(joining)
	assert_null(seats[0]["entry"])
	assert_true(seats[1]["mine"], "joining: seat 1, shown before any ASSIGN")
	assert_false(joining.is_host())
	assert_eq(LobbyState.action(joining, false, 0, DESKTOP), {"kind": LobbyState.ACTION_READY, "enabled": false})

func test_the_draft_room_waits_for_its_session() -> void:
	var room := DraftRoom.new(PlayerProfile.sanitize(PROFILE, _rng()), _rng(), true, ["os_arena"], [3])
	room.add_bot(1)
	room.set_mode(GameModes.BATTLE)
	room.set_local_ready(true)
	assert_null(room.slots[1], "no session: seat clicks do nothing (web sessionRef null)")
	assert_eq(room.mode, GameModes.DUEL)
	assert_false(room.is_ready(RoomModel.HOST_SLOT))
	room.set_map(["os_pillars", "os_arena"])
	room.set_duration([10])
	assert_eq([room.map_sel, room.duration_sel], [["os_pillars", "os_arena"], [10]], "wishes are kept (web draftSel)")

func test_invites_take_the_first_free_seats() -> void:
	var room := _host_room()
	room.set_mode(GameModes.WAR)
	room.add_bot(2)
	var second := {"id": "2", "name": "SECOND"}
	var drawn := LobbyState.invite_seats(LobbyState.seats(room), [INVITE, second])
	assert_eq(drawn, {1: INVITE, 3: second})
