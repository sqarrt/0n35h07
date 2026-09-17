extends GutTest
## Audio assets converted from the web build's Opus files (2.0.0): the manifest keeps the web stem order, every stem (and
## the silent filler) imports as an 8-second loop on the 120 bpm / 16-beat grid with one 16-beat bar, every web SFX
## event is present, and the baked loudness gains stay inside the web normalisation bounds.

const MANIFEST := "res://assets/audio/music/manifest.json"
const ORACLE := "res://tests/fixtures/music_oracle.json"
const MUSIC_DIR := "res://assets/audio/music/%s.ogg"
const SFX_DIR := "res://assets/audio/sfx/%s.ogg"
const MIN_GAIN := 0.25
const MAX_GAIN := 4.0
const WEB_SFX_EVENTS := ["beam_fire", "beam_fire_rage", "beam_fire_singularity", "block", "shield_up", "shield_down",
	"cooldown_ready", "dash", "jump", "land", "death", "respawn", "ui_click", "ui_hover", "ui_toggle", "ready",
	"room_join", "count_tick", "go", "catalyst", "double_kill", "triple_kill", "singularity", "shield_loop", "ghost_loop"]
const LOOPING_SFX := ["shield_loop", "ghost_loop"]

func _json(path: String) -> Dictionary:
	var json := JSON.new()
	assert_eq(json.parse(FileAccess.get_file_as_string(path)), OK, "%s parses" % path)
	return json.data

func test_manifest_keeps_the_web_stem_order() -> void:
	var manifest := _json(MANIFEST)
	assert_eq(manifest["roles"], _json(ORACLE)["library"], "same ids in the web localeCompare order")
	for stem_id in manifest["gains"]:
		var gain := float(manifest["gains"][stem_id])
		assert_between(gain, MIN_GAIN, MAX_GAIN, "%s gain" % stem_id)

func test_every_stem_is_an_eight_second_bar_loop() -> void:
	var manifest := _json(MANIFEST)
	var ids: Array = [manifest["silence"]]
	for role in manifest["roles"]:
		ids.append_array(manifest["roles"][role])
	for stem_id in ids:
		var stream := load(MUSIC_DIR % stem_id) as AudioStreamOggVorbis
		assert_not_null(stream, stem_id)
		if stream == null:
			continue
		assert_true(stream.loop, "%s loops" % stem_id)
		assert_eq(stream.bpm, float(manifest["bpm"]), "%s bpm" % stem_id)
		assert_eq(stream.beat_count, int(manifest["beat_count"]), "%s beats" % stem_id)
		assert_eq(stream.bar_beats, int(manifest["bar_beats"]), "%s: one bar per loop" % stem_id)

func test_every_web_sfx_event_is_present() -> void:
	for event in WEB_SFX_EVENTS:
		var stream := load(SFX_DIR % event) as AudioStreamOggVorbis
		assert_not_null(stream, event)
		if stream != null:
			assert_eq(stream.loop, event in LOOPING_SFX, "%s loop flag" % event)
