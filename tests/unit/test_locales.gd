extends GutTest
## Interface languages — web i18n LOCALES / detectLocale: the grid order and native names, exact then prefix matching,
## English otherwise, and the profile's choice over the system language.

func test_the_grid_order_and_names() -> void:
	assert_eq(Locales.ids(), ["en", "fr", "it", "de", "es", "zh-CN", "pt-BR", "ru", "tr", "pl"])
	assert_eq(Locales.NATIVE["pt-BR"], "Português (BR)")
	assert_eq(Locales.NATIVE.size(), Locales.ids().size())

func test_detect_matches_exactly_then_by_prefix() -> void:
	assert_eq(Locales.detect(["zh-cn"]), "zh-CN", "case-insensitive exact")
	assert_eq(Locales.detect(["pt_PT"]), "pt-BR", "OS separator, then the two-letter prefix")
	assert_eq(Locales.detect(["ja", "de-AT"]), "de", "the first language that matches")
	assert_eq(Locales.detect(["ja"]), Locales.FALLBACK)
	assert_eq(Locales.detect([]), Locales.FALLBACK)

func test_the_profile_choice_wins() -> void:
	assert_eq(Locales.of_profile({"locale": "ru"}), "ru")
	assert_eq(Locales.of_profile({}), Locales.detect([OS.get_locale()]), "not chosen: the system language")
