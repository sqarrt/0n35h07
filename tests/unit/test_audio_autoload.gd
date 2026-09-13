extends GutTest
## Global audio: the Audio autoload's SFX engine and volumes, menu music sessions, local room-code seeds, interface
## sounds on buttons, and the analysis hub max-combining its sources.

const EPS := 0.001
const SINE_BIN := 16
const FRAMES := 256

class FakeCapture:
	var frames := PackedVector2Array()
	func get_frames_available() -> int:
		return frames.size()
	func get_buffer(count: int) -> PackedVector2Array:
		var out := frames.slice(0, count)
		frames = frames.slice(count)
		return out

var _saved_profile := {}

func before_each() -> void:
	_saved_profile = Game.profile.duplicate()

func after_each() -> void:
	Game.profile = _saved_profile
	Audio.apply_volumes()
	Audio.stop_menu_music()

func _sine_capture() -> FakeCapture:
	var capture := FakeCapture.new()
	for n in FRAMES:
		var x := 0.5 * sin(TAU * SINE_BIN * n / FRAMES)
		capture.frames.append(Vector2(x, x))
	return capture

func test_the_autoload_owns_the_sfx_engine_and_applies_the_profile_volumes() -> void:
	assert_not_null(Audio.sfx())
	assert_eq(Audio.sfx().bus_name, Audio.SFX_BUS)
	Game.profile["volumeMaster"] = 0.5
	Game.profile["volumeSfx"] = 0.8
	Game.profile["volumeMusic"] = 0.6
	Audio.apply_volumes()
	var amplify := AudioBuses.effect(Audio.SFX_BUS, SfxEngine.EFFECT_AMPLIFY) as AudioEffectAmplify
	assert_almost_eq(amplify.volume_db, linear_to_db(SfxEngine.MASTER_GAIN * 0.4), EPS, "master x effects")
	assert_almost_eq(Audio.music_gain(), 0.3, EPS, "master x music")

func test_menu_music_sessions_start_once_and_fade_out() -> void:
	Audio.play_menu_music()
	var session := Audio.menu_music()
	assert_not_null(session)
	assert_true(session.is_started())
	Audio.play_menu_music()
	assert_eq(Audio.menu_music(), session, "no second session while it plays")
	Audio.stop_menu_music()
	assert_null(Audio.menu_music())
	assert_true(session.is_started(), "the stopped session fades out before it goes away")
	Audio.play_menu_music()
	assert_ne(Audio.menu_music().bus_prefix, session.bus_prefix, "a new session never shares the fading buses")

func test_room_codes_are_four_base36_characters() -> void:
	assert_eq(Audio.random_room_code(func() -> float: return 0.0), "0000")
	assert_eq(Audio.random_room_code(func() -> float: return 0.9999), "ZZZZ")
	assert_eq(Audio.random_room_code(func() -> float: return 0.5).length(), Audio.CODE_LENGTH)

func test_buttons_click_and_hover_through_the_sfx_engine() -> void:
	var button := Button.new()
	add_child_autofree(button)
	UiSounds.attach(button)
	var before := Audio.sfx().get_child_count()
	button.pressed.emit()
	button.mouse_entered.emit()
	assert_eq(Audio.sfx().get_child_count(), before + 2, "click and hover")
	button.disabled = true
	button.mouse_entered.emit()
	assert_eq(Audio.sfx().get_child_count(), before + 2, "a disabled button stays silent")

func test_the_hub_max_combines_its_sources() -> void:
	var hub := AudioAnalysisHub.new()
	var loud := _sine_capture()
	hub.add_capture(loud)
	hub.add_capture(loud)
	hub.add_capture(FakeCapture.new())
	assert_eq(hub.source_count(), 2, "one analyser per capture")
	hub.update()
	var peak := 0.0
	for value in hub.bands():
		peak = maxf(peak, value)
	assert_gt(peak, 0.0, "the sine shows up in the bands")
	assert_gt(hub.level(), 0.0)
	hub.remove_capture(loud)
	hub.update()
	assert_almost_eq(hub.level(), 0.0, EPS, "only the silent source is left")
