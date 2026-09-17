class_name MusicDirector extends RefCounted
## Match music composition — port of web game/audio/MusicDirector.ts: a pure, deterministic arrangement per 8-second
## loop from the room seed. Song form (intro, a repeating verse / chorus / bridge / solo body, an outro in the last 16 s),
## a single kick foundation per pattern pass, a rolling bass swap, colour stems by section, a lead ornament, a rest
## between different leads and seeded variety (lead doubling, reverb, echo). Random draws follow the web order exactly.
## `library` maps a role to its stem ids in the web order; a voice is {"role", "stem_id", "gain"} with optional
## "double_sec", "reverb" and "echo".

const ROLE_BASS := "bass"
const ROLE_KICKS := "kicks"
const ROLE_LEAD := "lead"
const ROLE_SFX := "sfx"
const INTRO := "intro"
const VERSE := "verse"
const CHORUS := "chorus"
const BRIDGE := "bridge"
const SOLO := "solo"
const OUTRO := "outro"
const FOUNDATION_KEY := "foundation"

const INTRO_LOOPS := 4
const OUTRO_MS := 16000.0
const SECTION_LOOPS := {INTRO: INTRO_LOOPS, VERSE: 4, CHORUS: 4, BRIDGE: 2, SOLO: 4, OUTRO: 1}
const BODY_PATTERN := [VERSE, CHORUS, VERSE, CHORUS, BRIDGE, SOLO, CHORUS]
const SECTION_ROLES := {
	INTRO: [ROLE_KICKS, ROLE_BASS],
	VERSE: [ROLE_KICKS, ROLE_BASS, ROLE_SFX, ROLE_LEAD],
	CHORUS: [ROLE_KICKS, ROLE_BASS, ROLE_SFX, ROLE_LEAD],
	BRIDGE: [ROLE_BASS, ROLE_SFX],
	SOLO: [ROLE_KICKS, ROLE_LEAD],
	OUTRO: [ROLE_KICKS, ROLE_LEAD],
}
const FOUNDATION_ROLES := [ROLE_KICKS]
const FOUNDATION_POOL := 2
const COLOR_POOL := 3
const BASS_BLOCK_LOOPS := 2
const BASS_PHASE := 1
const ORNAMENT_GAIN := 0.2
const ROLE_GAIN := {ROLE_BASS: 0.9, ROLE_KICKS: 1.0, ROLE_LEAD: 0.32, ROLE_SFX: 0.5}
const ROLE_SALT := {ROLE_BASS: 0x1111, ROLE_KICKS: 0x2222, ROLE_LEAD: 0x3333, ROLE_SFX: 0x4444}
const LEAD_SECTIONS := [VERSE, CHORUS, SOLO]
const FX_SALT := 0x5151
const DOUBLE_PROB := 0.55
const DOUBLE_MIN_SEC := 0.035
const DOUBLE_MAX_SEC := 0.090
const ECHO_SECTIONS := [CHORUS, SOLO, OUTRO]
const BRIDGE_REVERB := 0.34
const LOOP_REVERB_PROB := 0.40
const LOOP_REVERB := 0.22
const LEAD_ECHO_PROB := 0.45
const LEAD_ECHO := 0.20

## The arrangement of loop `loop_index` (0-based) with `remaining_ms` left on the match clock (INF before it runs).
func compose(seed: int, loop_index: int, library: Dictionary, remaining_ms: float) -> Array:
	var pos := section_at(loop_index, remaining_ms)
	var foundation_variant := (loop_index / pattern_loops()) % FOUNDATION_POOL
	var rest_lead := _lead_rests(loop_index, remaining_ms, pos)
	var voices := []
	for role in SECTION_ROLES[pos["type"]]:
		if role == ROLE_LEAD and rest_lead:
			continue
		var voice := _voice_for(role, pos, loop_index, foundation_variant, seed, library)
		if not voice.is_empty():
			voices.append(voice)
	var primary := _first_lead(voices)
	var ornament := _ornament_lead(pos, primary.get("stem_id", ""), seed, library)
	if not ornament.is_empty() and not voices.any(func(v: Dictionary) -> bool: return v["stem_id"] == ornament["stem_id"]):
		voices.append(ornament)
	_apply_variety(voices, seed, loop_index, pos)
	return voices

static func pattern_loops() -> int:
	var loops := 0
	for section in BODY_PATTERN:
		loops += SECTION_LOOPS[section]
	return loops

## {"type", "occurrence", "loop_in_section", "loops"}: outro by the remaining time, intro by the start, else the body.
static func section_at(loop_index: int, remaining_ms: float) -> Dictionary:
	if remaining_ms <= OUTRO_MS:
		return {"type": OUTRO, "occurrence": 0, "loop_in_section": 0, "loops": SECTION_LOOPS[OUTRO]}
	if loop_index < INTRO_LOOPS:
		return {"type": INTRO, "occurrence": 0, "loop_in_section": loop_index, "loops": INTRO_LOOPS}
	var body := loop_index - INTRO_LOOPS
	var occurrences := {}
	var i := 0
	while true:
		var type: String = BODY_PATTERN[i % BODY_PATTERN.size()]
		var loops: int = SECTION_LOOPS[type]
		var occurrence: int = occurrences.get(type, 0)
		if body < loops:
			return {"type": type, "occurrence": occurrence, "loop_in_section": body, "loops": loops}
		body -= loops
		occurrences[type] = occurrence + 1
		i += 1
	return {}

static func _pick_stem(seed: int, role: String, key: String, variant: int, library: Dictionary, gain: float) -> Dictionary:
	var stems: Array = library.get(role, [])
	if stems.is_empty():
		return {}
	var roll := MusicRng.new((seed ^ ROLE_SALT[role] ^ MusicRng.hash_seed(key)) & MusicRng.MASK).next()
	var base := floori(roll * stems.size())
	return {"role": role, "stem_id": stems[(base + variant) % stems.size()], "gain": gain}

static func _voice_for(role: String, pos: Dictionary, loop_index: int, foundation_variant: int, seed: int,
		library: Dictionary) -> Dictionary:
	if role == ROLE_LEAD and pos["type"] == OUTRO:
		return _pick_stem(seed, ROLE_LEAD, CHORUS, 0, library, ROLE_GAIN[ROLE_LEAD])
	if role in FOUNDATION_ROLES:
		return _pick_stem(seed, role, FOUNDATION_KEY, foundation_variant, library, ROLE_GAIN[role])
	if role == ROLE_BASS:
		var block := (loop_index + BASS_PHASE) / BASS_BLOCK_LOOPS
		return _pick_stem(seed, ROLE_BASS, ROLE_BASS, block, library, ROLE_GAIN[ROLE_BASS])
	return _pick_stem(seed, role, pos["type"], pos["occurrence"] % COLOR_POOL, library, ROLE_GAIN[role])

## A second lead on the last loop of a chorus (the verse lead) or a solo (the chorus lead), never the section's own.
static func _ornament_lead(pos: Dictionary, primary_lead_id: String, seed: int, library: Dictionary) -> Dictionary:
	if pos["loop_in_section"] != pos["loops"] - 1:
		return {}
	var source := VERSE if pos["type"] == CHORUS else (CHORUS if pos["type"] == SOLO else "")
	if source == "":
		return {}
	var voice := _pick_stem(seed, ROLE_LEAD, source, pos["occurrence"] % COLOR_POOL, library, ORNAMENT_GAIN)
	if voice.is_empty():
		return {}
	var stem_id: String = voice["stem_id"]
	if stem_id == primary_lead_id:
		var leads: Array = library[ROLE_LEAD]
		stem_id = leads[(leads.find(stem_id) + 1) % leads.size()]
		if stem_id == primary_lead_id:
			return {}
	return {"role": ROLE_LEAD, "stem_id": stem_id, "gain": ORNAMENT_GAIN}

## A loop of silence between two different leads: the first loop of a lead section after a section with a lead.
static func _lead_rests(loop_index: int, remaining_ms: float, pos: Dictionary) -> bool:
	if pos["loop_in_section"] != 0 or not pos["type"] in LEAD_SECTIONS:
		return false
	return ROLE_LEAD in SECTION_ROLES[section_at(loop_index - 1, remaining_ms)["type"]]

static func _first_lead(voices: Array) -> Dictionary:
	for voice in voices:
		if voice["role"] == ROLE_LEAD:
			return voice
	return {}

## Seeded per-loop variety (web applyVariety): draws happen only where the web short-circuits reach them.
static func _apply_variety(voices: Array, seed: int, loop_index: int, pos: Dictionary) -> void:
	var rng := MusicRng.new((seed ^ FX_SALT ^ loop_index) & MusicRng.MASK)
	var lead := _first_lead(voices)
	if not lead.is_empty() and pos["type"] in LEAD_SECTIONS and rng.next() < DOUBLE_PROB:
		lead["double_sec"] = DOUBLE_MIN_SEC + rng.next() * (DOUBLE_MAX_SEC - DOUBLE_MIN_SEC)
	var reverb := BRIDGE_REVERB if pos["type"] == BRIDGE else (LOOP_REVERB if rng.next() < LOOP_REVERB_PROB else 0.0)
	if reverb > 0.0:
		for voice in voices:
			if voice["role"] != ROLE_KICKS:
				voice["reverb"] = reverb
	if not lead.is_empty() and pos["type"] in ECHO_SECTIONS and rng.next() < LEAD_ECHO_PROB:
		lead["echo"] = LEAD_ECHO
