extends GutTest
## Music slot mapping: continuing stems keep their slot (web butt-joins the same stem id), new stems take a free slot
## of their role, dropped stems fall silent, and a doubled voice becomes a panned pair at the web gains.

const EPS := 0.001

func _voice(role: String, stem_id: String, gain: float, extra := {}) -> Dictionary:
	var voice := {"role": role, "stem_id": stem_id, "gain": gain}
	voice.merge(extra)
	return voice

func test_roles_fill_their_slots_and_missing_roles_are_silent() -> void:
	var slots := MusicSlots.new()
	var out := slots.assign([_voice("kicks", "kicks/a", 1.0), _voice("bass", "bass/b", 0.9)])
	assert_eq(out[MusicSlots.SLOT_KICKS]["stem_id"], "kicks/a")
	assert_almost_eq(out[MusicSlots.SLOT_BASS]["gain"], 0.9, EPS)
	assert_eq(out[MusicSlots.SLOT_LEAD_A]["stem_id"], MusicSlots.SILENT)
	assert_eq(out[MusicSlots.SLOT_DOUBLE]["stem_id"], MusicSlots.SILENT)

func test_a_continuing_lead_keeps_its_slot() -> void:
	var slots := MusicSlots.new()
	slots.assign([_voice("lead", "lead/x", 0.32), _voice("lead", "lead/y", 0.2)])
	var out := slots.assign([_voice("lead", "lead/y", 0.2)])
	assert_eq(out[MusicSlots.SLOT_LEAD_B]["stem_id"], "lead/y", "no crossfade for a stem that plays on")
	assert_eq(out[MusicSlots.SLOT_LEAD_A]["stem_id"], MusicSlots.SILENT, "the dropped lead fades out")
	out = slots.assign([_voice("lead", "lead/z", 0.32), _voice("lead", "lead/y", 0.2)])
	assert_eq(out[MusicSlots.SLOT_LEAD_A]["stem_id"], "lead/z", "a new stem takes the free slot")
	assert_eq(out[MusicSlots.SLOT_LEAD_B]["stem_id"], "lead/y")

func test_a_doubled_voice_splits_into_a_panned_pair() -> void:
	var slots := MusicSlots.new()
	var out := slots.assign([_voice("lead", "lead/x", 0.32, {"double_sec": 0.05, "reverb": 0.22, "echo": 0.2})])
	var primary: Dictionary = out[MusicSlots.SLOT_LEAD_A]
	var copy: Dictionary = out[MusicSlots.SLOT_DOUBLE]
	assert_almost_eq(primary["gain"], 0.32 * MusicSlots.DOUBLE_PRIMARY_GAIN, EPS)
	assert_almost_eq(primary["pan"], -MusicSlots.DOUBLE_PAN, EPS)
	assert_almost_eq(primary["delay_sec"], 0.0, EPS, "the primary is not delayed")
	assert_eq(copy["stem_id"], "lead/x")
	assert_almost_eq(copy["gain"], 0.32 * MusicSlots.DOUBLE_COPY_GAIN, EPS)
	assert_almost_eq(copy["pan"], MusicSlots.DOUBLE_PAN, EPS)
	assert_almost_eq(copy["delay_sec"], 0.05, EPS)
	assert_almost_eq(copy["reverb"], 0.22, EPS, "the copy keeps the sends")
