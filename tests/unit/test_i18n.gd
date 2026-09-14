extends GutTest

func after_each() -> void:
	I18n.use_locale(Locales.FALLBACK)

func test_english_by_default() -> void:
	assert_eq(I18n.locale(), "en")
	assert_eq(I18n.t("menuPlay"), "PLAY")

func test_active_locale_dictionary() -> void:
	I18n.use_locale("ru")
	assert_eq(I18n.locale(), "ru")
	assert_eq(I18n.t("menuPlay"), "ИГРАТЬ")
	I18n.use_locale("zh-CN")
	assert_eq(I18n.t("menuSettings"), "设置")

func test_unknown_locale_falls_back_to_english() -> void:
	I18n.use_locale("xx")
	assert_eq(I18n.locale(), "en")
	assert_eq(I18n.t("menuExit"), "QUIT")

func test_unknown_key_is_shown_as_is() -> void:
	assert_eq(I18n.t("noSuchKey"), "noSuchKey")

func test_templates_take_arguments() -> void:
	assert_eq(I18n.t("roomDurationMin", [5]), "5 MIN")
	assert_eq(I18n.t("relaysAlive", [2, 3]), "ALIVE 2/3")
	I18n.use_locale("ru")
	assert_eq(I18n.t("roomDurationMin", [10]), "10 МИН")

func test_every_locale_has_every_english_key() -> void:
	var english := I18n.dictionary("en")
	for id in Locales.ids():
		var entries := I18n.dictionary(id)
		for key in english:
			assert_true(entries.has(key), "%s lacks %s" % [id, key])

func test_only_chinese_is_cjk() -> void:
	for id in Locales.ids():
		I18n.use_locale(id)
		assert_eq(I18n.is_cjk(), id == "zh-CN", id)

func test_chinese_tightens_button_tracking() -> void:
	assert_eq(UiFont.control_spacing_em(UiButton.LETTER_SPACING_EM), UiButton.LETTER_SPACING_EM)
	I18n.use_locale("zh-CN")
	assert_eq(UiFont.control_spacing_em(UiButton.LETTER_SPACING_EM), UiFont.CJK_CONTROL_SPACING_EM)
	var chinese := autofree(UiButton.new("开始游戏")) as UiButton
	assert_eq((chinese.get_theme_font("font") as FontVariation).spacing_glyph,
		roundi(UiFont.CJK_CONTROL_SPACING_EM * UiButton.FONT_SIZE), "0.05em of 16 px")

func test_outcome_words_follow_the_locale() -> void:
	I18n.use_locale("ru")
	assert_eq(HudModel.outcome_label(MatchResult.OUTCOME_WIN), "ПОБЕДА")
	assert_eq(HudModel.reason_label(MatchResult.REASON_TIME), I18n.dictionary("ru")["matchReasonTime"])
	assert_eq(HudModel.outcome_label("unknown"), "")
