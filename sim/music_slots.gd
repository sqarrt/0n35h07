class_name MusicSlots extends RefCounted
## Maps each loop's voices (MusicDirector / MenuMusicArranger) onto the music engine's fixed role slots. A stem keeps
## its slot while it plays on — web continues a voice with the same stem id butt-jointed — new stems take a free slot of
## their role, and a slot whose stem was dropped falls silent (web fades the stem out). A doubled voice (web doubleSec)
## is split into a panned pair at reduced gain: the primary in its slot, the delayed copy in the double slot.
## A slot state is {"stem_id" ("" = silence), "gain", "pan", "reverb", "echo", "delay_sec"}.

const SLOT_KICKS := "kicks"
const SLOT_BASS := "bass"
const SLOT_SFX := "sfx"
const SLOT_LEAD_A := "lead_a"
const SLOT_LEAD_B := "lead_b"
const SLOT_DOUBLE := "lead_double"
const ROLE_SLOTS := {
	MusicDirector.ROLE_KICKS: [SLOT_KICKS],
	MusicDirector.ROLE_BASS: [SLOT_BASS],
	MusicDirector.ROLE_SFX: [SLOT_SFX],
	MusicDirector.ROLE_LEAD: [SLOT_LEAD_A, SLOT_LEAD_B],
}
const ALL_SLOTS := [SLOT_KICKS, SLOT_BASS, SLOT_SFX, SLOT_LEAD_A, SLOT_LEAD_B, SLOT_DOUBLE]
const DOUBLE_PRIMARY_GAIN := 0.66     # web DOUBLE_PRIMARY_GAIN: the pair is as loud as the single voice
const DOUBLE_COPY_GAIN := 0.66        # web DOUBLE_COPY_GAIN
const DOUBLE_PAN := 0.6               # web DOUBLE_PAN: primary left, copy right
const SILENT := ""

var _playing := {}                    # slot -> stem id of the last loop

func _init() -> void:
	for slot in ALL_SLOTS:
		_playing[slot] = SILENT

## The slot states of the next loop.
func assign(voices: Array) -> Dictionary:
	var out := {}
	for slot in ALL_SLOTS:
		out[slot] = silent_state()
	var pending := []
	for voice in voices:   # continuing stems keep their slot
		var slot := _slot_playing(voice, out)
		if slot == "":
			pending.append(voice)
		else:
			out[slot] = _state(voice)
	for voice in pending:
		var slot := _free_slot(voice, out)
		if slot == "":
			push_warning("MusicSlots: no free %s slot for %s" % [voice["role"], voice["stem_id"]])
			continue
		out[slot] = _state(voice)
	for slot in ROLE_SLOTS[MusicDirector.ROLE_LEAD]:
		var state: Dictionary = out[slot]
		if state["delay_sec"] > 0.0:
			out[SLOT_DOUBLE] = state.duplicate()
			out[SLOT_DOUBLE]["gain"] = state["gain"] * DOUBLE_COPY_GAIN / DOUBLE_PRIMARY_GAIN
			out[SLOT_DOUBLE]["pan"] = DOUBLE_PAN
			state["delay_sec"] = 0.0
			break
	for slot in ALL_SLOTS:
		_playing[slot] = out[slot]["stem_id"]
	return out

static func silent_state() -> Dictionary:
	return {"stem_id": SILENT, "gain": 0.0, "pan": 0.0, "reverb": 0.0, "echo": 0.0, "delay_sec": 0.0}

func _slot_playing(voice: Dictionary, taken: Dictionary) -> String:
	for slot in ROLE_SLOTS.get(voice["role"], []):
		if _playing[slot] == voice["stem_id"] and taken[slot]["stem_id"] == SILENT:
			return slot
	return ""

func _free_slot(voice: Dictionary, taken: Dictionary) -> String:
	for slot in ROLE_SLOTS.get(voice["role"], []):
		if taken[slot]["stem_id"] == SILENT:
			return slot
	return ""

static func _state(voice: Dictionary) -> Dictionary:
	var doubled := voice.has("double_sec")
	return {"stem_id": voice["stem_id"],
		"gain": float(voice["gain"]) * (DOUBLE_PRIMARY_GAIN if doubled else 1.0),
		"pan": -DOUBLE_PAN if doubled else 0.0,
		"reverb": float(voice.get("reverb", 0.0)), "echo": float(voice.get("echo", 0.0)),
		"delay_sec": float(voice.get("double_sec", 0.0))}
