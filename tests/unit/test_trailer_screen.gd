extends GutTest
## The trailer sequencer (web TrailerSequencer): the countdown's ticks and GO starting the music, a cut handing over to a
## play shot under the fading cover, GO ahead of later cuts, the banner outliving its shot, SKIP / Esc, the idle cursor,
## the finale's title and end, English throughout, and held parity frames.

const SCREEN := Vector2i(1280, 720)
const STEP_S := 0.05
const COUNTDOWN_INDEX := 0
const TEXT_INDEX := 1
const PLAY_INDEX := 2
const PLAY_BEFORE_PLAY_INDEX := 8
const FINALE_INDEX := 11
const WARMUP_STEPS := 3
const STREAK := 3
const SLAM_MS := 117.0                         # 13% of the 900 ms cut
const OTHER_LOCALE := "ru"
const FINALE_HOLD_MS := 5200.0                 # the beams hang, the title card has fully surfaced

var _sounds: Array = []

func before_each() -> void:
	_sounds = []

func after_each() -> void:
	Audio.stop_trailer_music()

func _screen(index := COUNTDOWN_INDEX, hold_ms := -1.0) -> TrailerScreen:
	var viewport := SubViewport.new()
	viewport.size = SCREEN
	add_child_autofree(viewport)
	var screen := TrailerScreen.new()
	screen.start_index = index
	if hold_ms >= 0.0:
		screen.hold_at(index, hold_ms)
	screen.play_sound = func(event: String, gain: float) -> void: _sounds.append([event, gain])
	viewport.add_child(screen)
	return screen

func _run(screen: TrailerScreen, seconds: float) -> void:
	for i in ceili(seconds / STEP_S):
		screen._process(STEP_S)

func _events() -> Array:
	return _sounds.map(func(sound: Array) -> String: return sound[0])

func test_the_countdown_ticks_then_go_starts_the_music() -> void:
	var screen := _screen()
	assert_true(screen.countdown().visible)
	assert_eq(_sounds, [[MatchAudioCues.COUNT_TICK, TrailerScreen.COUNTDOWN_SFX_GAIN]], "3 at full volume")
	assert_null(Audio.trailer_music(), "no music over the countdown")
	_run(screen, TrailerEdl.COUNTDOWN_MS / TrailerScreen.MS_PER_S + STEP_S)
	assert_eq(_events(), [MatchAudioCues.COUNT_TICK, MatchAudioCues.COUNT_TICK, MatchAudioCues.COUNT_TICK,
		MatchAudioCues.GO])
	assert_eq(screen.shot_index(), TEXT_INDEX)
	assert_not_null(Audio.trailer_music(), "GO starts the trailer music")

func test_a_cut_hands_over_to_a_play_shot_under_the_cover() -> void:
	var screen := _screen(TEXT_INDEX)
	assert_true(screen.cut().visible)
	assert_eq(screen.cut().text().label().text, TrailerEdl.SHOTS[TEXT_INDEX]["text"])
	_run(screen, TrailerEdl.CUT_MS / TrailerScreen.MS_PER_S + STEP_S)
	assert_eq(screen.shot_index(), PLAY_INDEX)
	assert_false(screen.cut().visible)
	assert_not_null(screen.playback())
	assert_true(screen.cover().visible)
	assert_eq(screen.cover().modulate.a, 1.0, "opaque until the scene has warmed up")
	for i in WARMUP_STEPS:
		screen.playback()._process(STEP_S)
	_run(screen, TrailerScreen.COVER_FADE_S + STEP_S)
	assert_eq(screen.cover().modulate.a, 0.0, "faded once ready")

func test_play_shot_sounds_are_dimmed_and_go_leads_later_cuts() -> void:
	var screen := _screen(PLAY_INDEX)
	screen.playback().sound.emit(DemoPlayback.DASH_SOUND)
	assert_eq(_sounds.back(), [DemoPlayback.DASH_SOUND, TrailerScreen.SFX_GAIN])
	screen.playback().near_end.emit()
	assert_eq(_sounds.back(), [MatchAudioCues.GO, TrailerScreen.COUNTDOWN_SFX_GAIN], "a cut comes next")
	var before_play := _screen(PLAY_BEFORE_PLAY_INDEX)
	_sounds.clear()
	before_play.playback().near_end.emit()
	assert_eq(_sounds, [], "no GO when a play shot follows")

func test_the_banner_outlives_its_play_shot() -> void:
	var screen := _screen(PLAY_INDEX)
	screen.playback().announced.emit("PARITY7", Streak.announce_kind(STREAK, false), UiTokens.ACCENT)
	assert_true(screen.banner().visible)
	screen.playback().ended.emit()
	assert_eq(screen.shot_index(), PLAY_INDEX + 1)
	assert_true(screen.banner().visible)

func test_skip_or_escape_finish_once() -> void:
	var screen := _screen()
	watch_signals(screen)
	var escape := InputEventAction.new()
	escape.action = TrailerScreen.PAUSE_ACTION
	escape.pressed = true
	screen._input(escape)
	screen.skip_button().pressed.emit()
	assert_signal_emit_count(screen, "done", 1)

func test_the_cursor_and_skip_hide_when_idle() -> void:
	var screen := _screen()
	var skip := screen.skip_button()
	assert_true(screen.is_idle())
	assert_eq(skip.modulate.a, 0.0)
	assert_eq(skip.mouse_filter, Control.MOUSE_FILTER_IGNORE, "no clicks while hidden")
	screen._input(InputEventMouseMotion.new())
	assert_false(screen.is_idle())
	_run(screen, TrailerSkipButton.FADE_S + STEP_S)
	assert_eq(skip.modulate.a, 1.0)
	_run(screen, TrailerScreen.CURSOR_IDLE_S)
	assert_true(screen.is_idle())

func test_the_finale_duel_plays_under_the_title_and_ends_the_trailer() -> void:
	var screen := _screen(FINALE_INDEX)
	watch_signals(screen)
	var finale := screen.finale()
	assert_not_null(finale)
	assert_lt(finale.get_index(), screen.title_card().get_index(), "the title surfaces over the duel")
	finale.sound.emit(DemoPlayback.BEAM_SOUNDS["rage"])
	assert_eq(_sounds.back(), [DemoPlayback.BEAM_SOUNDS["rage"], TrailerScreen.SFX_GAIN])
	finale.ended.emit()
	assert_signal_emit_count(screen, "done", 1)

func test_a_held_finale_frame_shows_the_duel_and_the_title() -> void:
	var screen := _screen(FINALE_INDEX, FINALE_HOLD_MS)
	assert_almost_eq(screen.finale().timeline.real_s, FINALE_HOLD_MS / TrailerScreen.MS_PER_S, 1.0 / 60.0)
	assert_true(screen.title_card().visible)
	for item in screen.title_card().items():
		assert_eq(item.opacity(), 1.0, "every line has surfaced")

func test_the_finale_shows_the_title_and_ends() -> void:
	var screen := _screen(FINALE_INDEX)
	watch_signals(screen)
	Audio.play_trailer_music()
	assert_false(screen.title_card().visible)
	_run(screen, TrailerScreen.TITLE_AT_S + STEP_S)
	assert_true(screen.title_card().visible)
	assert_null(Audio.trailer_music(), "the music rings out under the title")
	_run(screen, TrailerScreen.FINALE_END_S - TrailerScreen.TITLE_AT_S)
	assert_signal_emitted(screen, "done")

func test_the_trailer_speaks_english() -> void:
	var original := I18n.locale()
	I18n.use_locale(OTHER_LOCALE)
	var screen := _screen()
	assert_eq(I18n.locale(), TrailerScreen.LOCALE)
	screen.get_parent().remove_child(screen)
	screen.free()
	assert_eq(I18n.locale(), OTHER_LOCALE, "the player's language comes back")
	I18n.use_locale(original)

func test_a_held_frame_keeps_the_cut_on_its_moment() -> void:
	var screen := _screen(TEXT_INDEX, SLAM_MS)
	var expected: float = TrailerCut.text(SLAM_MS / TrailerEdl.CUT_MS)["opacity"]
	assert_almost_eq(screen.cut().fade().opacity(), expected, 0.001)
	_run(screen, TrailerEdl.CUT_MS / TrailerScreen.MS_PER_S)
	assert_eq(screen.shot_index(), TEXT_INDEX, "the clock is held")
	assert_almost_eq(screen.cut().fade().opacity(), expected, 0.001)
