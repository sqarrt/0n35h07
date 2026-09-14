extends GutTest
## The warning splash node: the dictionary texts and Chrome's line breaks, clicks ignored until the hint, the fade-out
## and `dismissed`, and the main menu showing it once per launch.

const SCREEN := Vector2i(1280, 720)
const EN_LINES := ["This game contains flashing images, strobes and sharp light effects. Not",
	"recommended for people with photosensitive epilepsy."]   # web .warn-text line boxes (1280×720, en)

func after_each() -> void:
	I18n.use_locale(Locales.FALLBACK)

func _splash() -> WarningSplash:
	var viewport := SubViewport.new()
	viewport.size = SCREEN
	add_child_autofree(viewport)
	var splash := WarningSplash.new()
	viewport.add_child(splash)
	return splash

func test_the_texts_come_from_the_dictionary() -> void:
	var splash := _splash()
	assert_eq(splash.title_text(), I18n.t(WarningSplash.TITLE_KEY))
	assert_eq(" ".join(splash.body_lines()), I18n.t(WarningSplash.BODY_KEY))
	assert_eq(splash.chip_label().text, I18n.t(WarningSplash.KEY_KEY))
	assert_eq(splash.hint_label().text, I18n.t(WarningSplash.HINT_KEY))

func test_the_paragraph_breaks_like_chrome() -> void:
	var splash := _splash()
	assert_eq(Array(splash.body_lines()), EN_LINES)
	assert_almost_eq(splash.body_width(), 709.92, 0.1, "the widest line box")

func test_cjk_breaks_between_characters_not_before_punctuation() -> void:
	var measure := func(text: String) -> float: return float(text.length())
	assert_eq(Array(CssLineBreak.lines("一二三。四五", 3.0, measure)), ["一二", "三。四", "五"])
	assert_eq(Array(CssLineBreak.lines("ab cd ef", 5.0, measure)), ["ab cd", "ef"])

func test_clicks_before_the_hint_are_ignored() -> void:
	var splash := _splash()
	watch_signals(splash)
	splash.advance(WarningTimeline.HINT_DELAY_MS - 1.0)
	splash.try_dismiss()
	splash.advance(WarningTimeline.FADE_OUT_MS)
	assert_signal_not_emitted(splash, "dismissed")
	assert_eq(splash.modulate.a, 1.0)

func test_a_click_after_the_hint_fades_the_screen_out() -> void:
	var splash := _splash()
	watch_signals(splash)
	splash.advance(WarningTimeline.HINT_DELAY_MS)
	splash.try_dismiss()
	splash.advance(WarningTimeline.FADE_OUT_MS * 0.5)
	assert_lt(splash.modulate.a, 1.0, "fading")
	assert_signal_not_emitted(splash, "dismissed")
	splash.advance(WarningTimeline.FADE_OUT_MS * 0.5)
	assert_signal_emitted(splash, "dismissed")

func test_the_menu_shows_it_once_per_launch() -> void:
	var seen: bool = Game.warning_seen
	Game.warning_seen = false
	var viewport := SubViewport.new()
	viewport.size = SCREEN
	add_child_autofree(viewport)
	var menu := (load("res://scenes/main_menu.tscn") as PackedScene).instantiate() as MainMenu
	viewport.add_child(menu)
	var splash := menu.find_child("WarningSplash", true, false) as WarningSplash
	assert_not_null(splash, "web App showWarning on launch")
	splash.advance(WarningTimeline.HINT_DELAY_MS)
	splash.try_dismiss()
	splash.advance(WarningTimeline.FADE_OUT_MS)
	await wait_process_frames(1)
	assert_true(Game.warning_seen)
	var again := (load("res://scenes/main_menu.tscn") as PackedScene).instantiate() as MainMenu
	viewport.add_child(again)
	assert_null(again.find_child("WarningSplash", true, false), "back from a match: no warning")
	Game.warning_seen = seen
