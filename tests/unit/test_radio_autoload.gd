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
const SEEK := "seek"
const VOLUME := "volume"
const PAGE_READY := '{"event":"ready"}'
const ENGINE_READY := '{"event":"init-state","state":"ready"}'
const GENERATED := '{"event":"generated"}'
const TEST_LIBRARY := "user://test_radio_autoload_library"

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

func test_a_seek_moves_the_bar_at_once() -> void:
	var made := _radio(0)
	made[0].warm_up()
	made[1].deliver(PAGE_READY)
	made[1].sent.clear()
	made[0].seek(0.5)
	assert_eq(_names(made[1]), [SEEK])
	assert_eq(made[0].model.progress, 0.5, "web setRadioProgress before the next poll")

func test_the_volume_reaches_the_engine() -> void:
	var made := _radio(0)
	made[0].warm_up()
	made[1].deliver(PAGE_READY)
	made[1].sent.clear()
	made[0].apply_volume()
	assert_eq(_names(made[1]), [VOLUME])

func test_the_pages_meter_reaches_the_menus_audio_analysis() -> void:
	var made := _radio(0)
	var radio = made[0]
	made[1].deliver('{"event":"meter","level":0.05,"bands":[0.9,0.1,0,0,0,0,0,0]}')
	Audio.analysis.update()
	var radio_level: float = 0.05 * RADIO.LEVEL_SCALE
	# the shared hub also hears the menu's real buses (other suites leave sound playing): only the radio's share is ours
	assert_gte(Audio.analysis.level(), radio_level - 0.001, "web RADIO_LEVEL_SCALE")
	var beat := PackedFloat32Array()
	beat.resize(8)
	Audio.analysis.fill_bands(beat)
	assert_almost_eq(beat[0], 0.9, 0.001, "the page's bands at their own count")
	radio.free()
	Audio.analysis.update()
	assert_lt(Audio.analysis.level(), radio_level * 0.5, "gone with the radio")

func _track(track_name: String) -> Dictionary:
	return {"v": 2, "id": track_name, "name": track_name, "bpm": 120, "bars": 32, "info": {}, "program": "arrange()"}

func _baked(transport: FakeTransport) -> Array:
	return transport.commands().filter(func(command: Dictionary) -> bool: return command[CMD] == RadioProtocol.PLAY_BAKED) \
		.map(func(command: Dictionary) -> String: return command["track"]["name"])

func test_the_library_queue_plays_steps_and_loops_on_track_end() -> void:
	var made := _radio(0)
	var radio = made[0]
	var transport: FakeTransport = made[1]
	transport.deliver(PAGE_READY)
	radio.play_library([_track("A"), _track("B"), _track("C")], 2)
	assert_eq(radio.play_mode, RADIO.MODE_FAV)
	radio.next()
	radio.prev()
	radio.prev()
	transport.deliver('{"event":"track-end"}')
	assert_eq(_baked(transport), ["C", "A", "C", "B", "C"], "start, next wraps, prev, prev, the end moves on")
	transport.sent.clear()
	radio.set_play_mode(RADIO.MODE_GEN)
	radio.next()
	transport.deliver('{"event":"track-end"}')
	assert_eq(_names(transport), [RadioProtocol.RESUME_GENERATIVE, RadioProtocol.NEXT], "On Air: the live stream again")

func test_the_audible_track_becomes_a_library_payload() -> void:
	var made := _radio(0)
	var radio = made[0]
	var transport: FakeTransport = made[1]
	assert_eq(radio.current_track_payload(), {}, "nothing playing")
	transport.deliver(JSON.stringify({"event": "state", "state": {"seed": "AA3C39", "trackIndex": 3, "trackSeed": "AA3C39:t3",
		"strudelCode": "setcpm(30)", "mood": "dub_techno", "key": "A", "scaleName": "phrygian", "bpm": 123}}))
	transport.deliver('{"event":"progress","progress":0.1,"totalMs":90000,"running":true,"bars":48}')
	var payload: Dictionary = radio.current_track_payload()
	assert_eq(payload["id"], "AA3C39:3", "web trackId(seed, index)")
	assert_eq(payload["name"], radio.model.track_label())
	assert_eq(payload["bars"], 48.0)
	assert_eq(payload["info"], {"mood": "dub_techno", "key": "A", "scale": "phrygian"})
	assert_eq(payload["program"], "setcpm(30)")

func test_a_save_counts_against_the_trial_and_a_spent_one_is_refused() -> void:
	var made := _radio(0)
	var radio = made[0]
	var library := RadioLibrary.new(TEST_LIBRARY)
	RadioLibrarySeed.clear(library)
	assert_true(radio.save_track(library, "", _track("Kept")))
	assert_eq(int(Game.profile[RadioRights.KEY_TRIAL]["saves"]), 1)
	assert_eq(_saves, 1)
	assert_eq(library.list_dir("").size(), 1)
	Game.profile[RadioRights.KEY_TRIAL]["saves"] = RadioEntitlement.FREE_SAVES_PER_DAY
	assert_false(radio.save_track(library, "", _track("Refused")))
	assert_true(radio.save_limited, "web radioSavePrompt")
	assert_eq(library.list_dir("").size(), 1)
	RadioLibrarySeed.clear(library)

func test_a_match_keeps_the_radio_only_when_it_started_with_it() -> void:
	var made := _radio(0)
	var radio = made[0]
	var transport: FakeTransport = made[1]
	Game.profile[RADIO.KEY_ENABLED] = true
	radio.warm_up()
	transport.deliver(PAGE_READY)
	transport.deliver(ENGINE_READY)
	transport.sent.clear()
	radio.set_screen(RadioDirector.SCREEN_GAME, true)
	assert_eq(_names(transport), [VOLUME, RESUME], "web radioForMatch: playing through the match")
	transport.sent.clear()
	radio.set_screen(RadioDirector.SCREEN_GAME)
	assert_eq(_names(transport), [RadioProtocol.STOP], "a match that chose its own music")

func test_the_trial_strip_and_the_daily_limit() -> void:
	var made := _radio(RadioEntitlement.FREE_GENS_PER_DAY)
	var radio = made[0]
	assert_eq(radio.trial_strip(), {}, "not known before Steam answers")
	radio.warm_up()
	assert_eq(radio.trial_strip(), {"gens_left": 0, "saves_left": RadioEntitlement.FREE_SAVES_PER_DAY})
	assert_true(radio.can_unlock())
	assert_false(radio.gen_limited(), "switched off: no limit line")
	Game.profile[RADIO.KEY_ENABLED] = true
	assert_true(radio.gen_limited())
