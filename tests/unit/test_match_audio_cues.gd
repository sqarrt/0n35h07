extends GutTest
## Match sound cues: countdown ticks on 3 / 2 / 1 only when the count changes, GO once on going live, the end cue once,
## and the web announce sounds by kind.

func test_countdown_ticks_then_go_once() -> void:
	var cues := MatchAudioCues.new()
	assert_eq(cues.step("3", false, false), [MatchAudioCues.COUNT_TICK], "the first shown second")
	assert_eq(cues.step("3", false, false), [], "only when the count changes")
	assert_eq(cues.step("2", false, false), [MatchAudioCues.COUNT_TICK])
	assert_eq(cues.step("1", false, false), [MatchAudioCues.COUNT_TICK])
	assert_eq(cues.step("", true, false), [MatchAudioCues.GO])
	assert_eq(cues.step("", true, false), [], "GO once")
	assert_eq(cues.step("", false, true), [MatchAudioCues.ENDED])
	assert_eq(cues.step("", false, true), [], "the end cue once")

func test_counts_above_three_stay_silent() -> void:
	var cues := MatchAudioCues.new()
	assert_eq(cues.step("4", false, false), [])
	assert_eq(cues.step("3", false, false), [MatchAudioCues.COUNT_TICK])

func test_announce_sounds_by_kind() -> void:
	assert_eq(MatchAudioCues.announce_event("catalyst"), "catalyst")
	assert_eq(MatchAudioCues.announce_event("double"), "double_kill")
	assert_eq(MatchAudioCues.announce_event("triple"), "triple_kill")
	assert_eq(MatchAudioCues.announce_event("singularity"), "singularity")
	assert_eq(MatchAudioCues.announce_event(""), "")
