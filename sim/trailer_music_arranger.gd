class_name TrailerMusicArranger extends RefCounted
## The trailer's music — port of web game/audio/TrailerMusic: a deterministic arrangement of the menu's stems with no
## fade-in (it enters at full strength on the countdown's GO): kicks and bass, the first lead from the second loop, the
## second lead from the third loop on.

const KICK_ID := MenuMusicArranger.KICK_ID
const BASS_ID := MenuMusicArranger.BASS_ID
const LEAD_IDS := MenuMusicArranger.COLOR_IDS  # crickets_tex, then lwt_14
const KICK_GAIN := 1.25
const BASS_GAIN := 0.9
const LEAD_GAIN := 0.5
const LEAD_FROM_LOOPS := [1, 2]                # each lead's first loop
const FADE_IN_SEC := 0.0                       # web start(): straight to full

func arrange(loop_index: int) -> Array:
	var voices := [{"role": MusicDirector.ROLE_KICKS, "stem_id": KICK_ID, "gain": KICK_GAIN},
		{"role": MusicDirector.ROLE_BASS, "stem_id": BASS_ID, "gain": BASS_GAIN}]
	for i in LEAD_IDS.size():
		if loop_index >= LEAD_FROM_LOOPS[i]:
			voices.append({"role": MusicDirector.ROLE_LEAD, "stem_id": LEAD_IDS[i], "gain": LEAD_GAIN})
	return voices
