extends GutTest
## The trailer's storyboard and music against web trailerEdl.ts / TrailerMusic.ts.

const MAX_FRAGMENT_FRAMES := 45                # web: a fragment ≤ ~1.5 s at 30 fps

func test_the_storyboard_order() -> void:
	var types := TrailerEdl.SHOTS.map(func(shot: Dictionary) -> String: return shot["type"])
	assert_eq(types.front(), TrailerEdl.COUNTDOWN, "3-2-1 over emptiness first")
	assert_eq(types.back(), TrailerEdl.FINALE)
	assert_eq(TrailerEdl.first_text_index(), 1)
	assert_eq(TrailerEdl.clips(), ["os_arena", "os_india", "os_pillars"])

func test_every_fragment_is_short_and_inside_its_recording() -> void:
	var frames := {}
	for id in TrailerEdl.clips():
		frames[id] = DemoClip.load_clip(id).frames.size()
	for shot in TrailerEdl.SHOTS:
		if shot["type"] != TrailerEdl.PLAY:
			continue
		for fragment in shot["ranges"]:
			assert_lt(fragment[0], fragment[1])
			assert_lte(fragment[1] - fragment[0], MAX_FRAGMENT_FRAMES, "%s %s" % [shot["clip"], fragment])
			assert_lt(fragment[1], frames[shot["clip"]])

func test_the_music_builds_up_without_randomness() -> void:
	var arranger := TrailerMusicArranger.new()
	var ids := func(loop: int) -> Array:
		return arranger.arrange(loop).map(func(voice: Dictionary) -> String: return voice["stem_id"])
	assert_eq(ids.call(0), [TrailerMusicArranger.KICK_ID, TrailerMusicArranger.BASS_ID], "kicks + bass")
	assert_eq(ids.call(1).size(), 3, "+ lead 1")
	assert_eq(ids.call(2), ids.call(7), "+ lead 2 and on to the end")
	assert_eq(arranger.arrange(0)[0]["gain"], TrailerMusicArranger.KICK_GAIN)
