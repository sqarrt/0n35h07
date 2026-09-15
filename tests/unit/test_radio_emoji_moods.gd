extends GutTest
## RadioEmojiMoods — web emojiSetFor: specific qualifiers before generic ones, case-insensitive, the fallback otherwise.

func _key_of(mood: String) -> String:
	for entry in RadioEmojiMoods.MOODS:
		if RadioEmojiMoods.set_for(mood) == entry[RadioEmojiMoods.SET]:
			return entry[RadioEmojiMoods.KEY]
	return "fallback"

func test_compound_moods_land_in_their_set() -> void:
	assert_eq(_key_of("dark_hypnotic"), "hypnotic")
	assert_eq(_key_of("dark_ambient"), "ambient")
	assert_eq(_key_of("dub_techno"), "dub")
	assert_eq(_key_of("acid_dark"), "acid")
	assert_eq(_key_of("dark_techno"), "techno")
	assert_eq(_key_of("hard_techno"), "techno")
	assert_eq(_key_of("industrial"), "industrial")
	assert_eq(_key_of("dark"), "dark")

func test_case_and_unknown_moods() -> void:
	assert_eq(_key_of("ACID"), "acid")
	assert_eq(RadioEmojiMoods.set_for("Chill"), RadioEmojiMoods.FALLBACK)
	assert_eq(RadioEmojiMoods.set_for(""), RadioEmojiMoods.FALLBACK)
