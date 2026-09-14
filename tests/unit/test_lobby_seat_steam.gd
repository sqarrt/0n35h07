extends GutTest
## The lobby seat's Steam states (web components/lobby/Seats): a desktop host's free seat stacks INVITE A FRIEND over ADD
## A BOT, a guest's free seat is TAKE THIS SEAT, a sent invite waits with ✕ and a pulsing tag, and a searching seat
## spins names.

const SCREEN := Vector2i(640, 360)
const SEAT_SIZE := Vector2(263.0, 108.0)
const SLOT := 1
const FRIEND := "FRIEND"
const SPIN := "RA9.."
const EPS := 0.01

func _seat() -> LobbySeat:
	var viewport := SubViewport.new()
	viewport.size = SCREEN
	add_child_autofree(viewport)
	var seat := LobbySeat.new()
	seat.slot = SLOT
	viewport.add_child(seat)
	seat.size = SEAT_SIZE
	return seat

func test_a_desktop_host_seat_invites_or_adds_a_bot() -> void:
	var seat := _seat()
	seat.invites = true
	seat.show_seat(null, false, false, true)
	var zones := seat.zones()
	assert_eq(zones.map(func(zone: Button) -> String: return zone.name), ["Invite", "AddBot"])
	assert_almost_eq(zones[0].size.y, zones[1].size.y, EPS, "the zones share the card")
	assert_almost_eq(zones[1].position.y - zones[0].position.y - zones[0].size.y, LobbySeat.GAP, EPS)
	assert_not_null(zones[0].plus, "INVITE A FRIEND leads with ＋")
	watch_signals(seat)
	zones[0].pressed.emit()
	assert_signal_emitted_with_parameters(seat, "invite_requested", [SLOT])

func test_a_guest_takes_a_free_seat() -> void:
	var seat := _seat()
	seat.show_seat(null, false, false, false)
	assert_eq(seat.zones().map(func(zone: Button) -> String: return zone.name), ["TakeSeat"])
	watch_signals(seat)
	seat.zones()[0].pressed.emit()
	assert_signal_emitted_with_parameters(seat, "take_requested", [SLOT])

func test_a_sent_invite_waits_and_pulses() -> void:
	var seat := _seat()
	seat.show_waiting(FRIEND)
	assert_true(seat.is_waiting())
	assert_eq((seat.find_child("Nick", true, false) as Label).text, FRIEND)
	var dot := seat.find_child("Dot", true, false) as Control
	seat._process(LobbySeat.PULSE_S * 0.5)
	assert_almost_eq(dot.modulate.a, 1.0, EPS, "invitePulse peaks halfway")
	seat._process(LobbySeat.PULSE_S * 0.5)
	assert_almost_eq(dot.modulate.a, 0.35, EPS)
	watch_signals(seat)
	(seat.find_child("Remove", true, false) as Button).pressed.emit()
	assert_signal_emitted_with_parameters(seat, "invite_cancelled", [SLOT])

func test_a_searching_seat_spins_names() -> void:
	var seat := _seat()
	seat.show_searching("")
	seat.show_searching(SPIN)
	assert_eq((seat.find_child("Nick", true, false) as Label).text, SPIN)
	assert_eq(seat.zones().size(), 0, "no action zones while searching")
