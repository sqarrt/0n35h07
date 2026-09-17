extends GutTest
## The network test harness (NetDiag): off unless the run asks for it, each window logging into a folder of its own,
## and the pilot that plays a window — a square walk, a sweeping aim and a steady beat, offset per seat so two windows
## don't move in lockstep.

const DT := 1.0 / 60.0
const SEAT := 0
const OTHER_SEAT := 1

func test_it_is_off_unless_the_run_asks() -> void:
	assert_false(NetDiag.is_on(PackedStringArray()))
	assert_false(NetDiag.is_on(PackedStringArray(["--windowed"])))
	assert_true(NetDiag.is_on(PackedStringArray([NetDiag.FLAG])))

func test_every_window_logs_into_its_own_folder() -> void:
	# Windows share one user://, and the session file is named by the second — two of them would write over each other.
	assert_ne(NetDiag.dir_for(1000), NetDiag.dir_for(1001))
	assert_true(NetDiag.dir_for(1000).begins_with(NetDiag.DIR))

func test_the_pilot_walks_the_sides_of_a_square() -> void:
	var pilot := NetDiagPilot.new(SEAT)
	var legs := {}
	for i in int(NetDiagPilot.LEG_S * NetDiagPilot.LEGS.size() / DT):
		pilot.step(DT)
		legs[pilot.move().normalized()] = true
	assert_eq(legs.size(), NetDiagPilot.LEGS.size(), "all four sides")
	for direction in legs:
		assert_almost_eq((direction as Vector3).length(), 1.0, 0.001)
	assert_almost_eq(pilot.move().length(), MoveConst.MOVE_SPEED, 0.001, "at walking speed")

func test_the_aim_sweeps_and_the_beat_keeps_time() -> void:
	var pilot := NetDiagPilot.new(SEAT)
	var shots := 0
	var start := pilot.yaw()
	for i in int(NetDiagPilot.FIRE_INTERVAL_S * 3.0 / DT) + 1:   # +1: the last beat lands on the frame that reaches it
		pilot.step(DT)
		if pilot.fires():
			shots += 1
	assert_eq(shots, 3, "one shot per beat, not one a frame")
	assert_gt(pilot.yaw(), start, "and the view keeps turning")

func test_two_seats_do_not_move_in_lockstep() -> void:
	var one := NetDiagPilot.new(SEAT)
	var two := NetDiagPilot.new(OTHER_SEAT)
	one.step(DT)
	two.step(DT)
	assert_ne(one.move(), two.move(), "the seats start on different sides")
	assert_ne(one.yaw(), two.yaw())

# --- the jitter probe: it has to tell a gliding ball from a shaking one ---

const TICK_MS := 1000.0 / 60.0
const GLIDE_STEP := 0.1
const JITTER_ID := 3

class Lines extends RefCounted:
	var all: Array[String] = []
	func enqueue(line: String) -> void:
		all.append(line)

func _jitter_lines(samples: Array) -> Array[String]:
	# `samples` are [now_ms, Vector3] placements; the probe reports once the window is over.
	var sink := Lines.new()
	GameLog.install(sink, func() -> String: return "T", func() -> int: return 0)
	var probe := NetDiagJitter.new()
	for s in samples:
		probe.sample(JITTER_ID, float(s[0]), s[1] as Vector3)
	probe.step(NetDiagJitter.REPORT_S)
	GameLog.uninstall()
	return sink.all

func test_an_evenly_arriving_ball_reads_as_gliding() -> void:
	var samples := []
	for i in 10:
		samples.append([i * TICK_MS, Vector3(i * GLIDE_STEP, 0, 0)])
	var lines := _jitter_lines(samples)
	assert_eq(lines.size(), 1, "one line a window per remote")
	assert_string_contains(lines[0], "stale=0")
	assert_string_contains(lines[0], "back=0")

func test_a_ball_that_stalls_and_doubles_back_is_counted() -> void:
	# What a shaking ball looks like from here: a tick with no movement, then one that overshoots, then a step back.
	var lines := _jitter_lines([
		[0.0, Vector3.ZERO],
		[TICK_MS, Vector3.ZERO],                      # stalled
		[TICK_MS * 2.0, Vector3(GLIDE_STEP * 2.0, 0, 0)],
		[TICK_MS * 3.0, Vector3(GLIDE_STEP, 0, 0)],   # back the way it came
	])
	assert_eq(lines.size(), 1)
	assert_string_contains(lines[0], "stale=1")
	assert_string_contains(lines[0], "back=1")

func test_it_stays_quiet_until_the_window_is_over() -> void:
	var sink := Lines.new()
	GameLog.install(sink, func() -> String: return "T", func() -> int: return 0)
	var probe := NetDiagJitter.new()
	probe.sample(JITTER_ID, 0.0, Vector3.ZERO)
	probe.sample(JITTER_ID, TICK_MS, Vector3(GLIDE_STEP, 0, 0))
	probe.step(NetDiagJitter.REPORT_S * 0.5)
	GameLog.uninstall()
	assert_eq(sink.all.size(), 0)
