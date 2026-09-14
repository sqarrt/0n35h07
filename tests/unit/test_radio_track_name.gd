extends GutTest
## RadioTrackName — web src/radio/trackName.ts: the same {mood, bpm, key, trackSeed} gives the same name. The oracle
## is web's own function (web-reference scripts/export-radio-track-names.mjs → tests/fixtures/radio_track_names.json).

const FIXTURE := "res://tests/fixtures/radio_track_names.json"

func test_every_oracle_name_matches() -> void:
	var json := JSON.new()
	assert_eq(json.parse(FileAccess.get_file_as_string(FIXTURE)), OK, "the oracle fixture")
	var cases: Array = json.data
	assert_gt(cases.size(), 0)
	var mismatches := []
	for c in cases:
		var name := RadioTrackName.of(c["mood"], c["bpm"], c["key"], c["trackSeed"])
		if name != c["name"]:
			mismatches.append("%s → %s (web %s)" % [c["trackSeed"], name, c["name"]])
	assert_eq(mismatches, [], "names differ from web")

func test_numbers_read_like_javascript() -> void:
	assert_eq(RadioTrackName.number_text(133.0), "133", "a JSON float that is whole")
	assert_eq(RadioTrackName.number_text(133.5), "133.5")
