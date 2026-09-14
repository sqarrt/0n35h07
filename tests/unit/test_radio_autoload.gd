extends GutTest
## The Radio autoload's free trial on a fake page: a spent quota closes the page's generation gate before the engine
## starts, each generated track counts and saves the profile, the last free one closes the gate, and owning the DLC
## reopens it and resumes the stream.

const RADIO := preload("res://autoloads/radio.gd")
const TODAY := "2026-06-28"
const CMD := "cmd"
const GATE := "gate"
const INIT := "init"
const RESUME := "resume"
const PAGE_READY := '{"event":"ready"}'
const ENGINE_READY := '{"event":"init-state","state":"ready"}'
const GENERATED := '{"event":"generated"}'

class FakeTransport extends RadioTransport:
	var sent: Array[String] = []

	func send(text: String) -> void:
		sent.append(text)

	func deliver(text: String) -> void:
		received.emit(text)

	func commands() -> Array:
		return sent.map(func(text: String) -> Dictionary: return JSON.parse_string(text))

var _profile_before: Dictionary
var _owned := false
var _saves := 0

func before_each() -> void:
	_profile_before = Game.profile
	_owned = false
	_saves = 0

func after_each() -> void:
	Game.profile = _profile_before

func _radio(gens: int) -> Array:
	Game.profile = {RadioRights.KEY_TRIAL: {"day": TODAY, "gens": gens, "saves": 0}}
	var radio = RADIO.new()
	add_child_autofree(radio)
	radio.rights.dev_unlimited = false                  # GUT runs from the editor binary
	radio.owns_dlc = func() -> bool: return _owned
	radio.today = func() -> String: return TODAY
	radio.save_profile = func(_profile: Dictionary) -> void: _saves += 1
	var transport := FakeTransport.new()
	radio.attach_host(RadioHost.new(transport))
	return [radio, transport]

func _names(transport: FakeTransport) -> Array:
	return transport.commands().map(func(command: Dictionary) -> String: return command[CMD])

func test_a_spent_trial_closes_the_gate_before_the_engine_starts() -> void:
	var made := _radio(RadioEntitlement.FREE_GENS_PER_DAY)
	made[0].warm_up()
	made[1].deliver(PAGE_READY)
	assert_eq(_names(made[1]), [GATE, INIT])
	assert_eq(made[1].commands()[0]["canGenerate"], false)

func test_an_open_trial_leaves_the_gate_alone() -> void:
	var made := _radio(0)
	made[0].warm_up()
	made[1].deliver(PAGE_READY)
	assert_eq(_names(made[1]), [INIT])

func test_each_generated_track_counts_and_saves() -> void:
	var made := _radio(0)
	made[0].warm_up()
	made[1].deliver(PAGE_READY)
	made[1].deliver(GENERATED)
	assert_eq(int(Game.profile[RadioRights.KEY_TRIAL]["gens"]), 1)
	assert_eq(_saves, 1, "web bumpTrial saves the profile")

func test_the_last_free_track_closes_the_gate() -> void:
	var made := _radio(RadioEntitlement.FREE_GENS_PER_DAY - 1)
	made[0].warm_up()
	made[1].deliver(PAGE_READY)
	made[1].deliver(GENERATED)
	assert_eq(_names(made[1]).back(), GATE)
	assert_eq(made[1].commands().back()["canGenerate"], false)

func test_buying_the_dlc_reopens_the_gate_and_resumes() -> void:
	var made := _radio(RadioEntitlement.FREE_GENS_PER_DAY)
	var radio = made[0]
	Game.profile[RADIO.KEY_ENABLED] = true
	radio.warm_up()
	made[1].deliver(PAGE_READY)
	made[1].deliver(ENGINE_READY)
	made[1].sent.clear()
	_owned = true
	radio.recheck_dlc()
	var names := _names(made[1])
	assert_eq(names.front(), GATE)
	assert_eq(made[1].commands()[0]["canGenerate"], true)
	assert_true(names.has(RESUME), "the halted stream starts again")
	assert_eq(Game.profile[RadioRights.KEY_OWNED], true)
