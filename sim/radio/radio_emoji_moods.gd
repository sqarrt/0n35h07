class_name RadioEmojiMoods
## The Radio takeover's emoji per track mood — web RadioTakeover MOOD_EMOJI: the first key found in the mood (lower
## case, as a substring, specific qualifiers before generic ones) picks the set — dark_hypnotic is occult, dark_ambient
## ambient, dub_techno dub, acid_dark acid, dark_techno and hard_techno techno — else the fallback set.

const MOODS := [
	["hypnotic", ["👁️", "🔮", "🕯️", "🧿", "🪬", "🎭", "♟️", "⚱️"]],
	["ambient", ["🌑", "🌚", "🕳️", "🌫️", "🤍", "❄️", "🧊", "🖤"]],
	["acid", ["☢️", "☣️", "⚠️", "🧬", "🩸", "👁️", "🩻"]],
	["dub", ["🌑", "🌫️", "🕳️", "🌀", "🤍", "⛓️", "🌊", "🧊"]],
	["industrial", ["⚙️", "🔩", "🔗", "⛓️", "🔪", "⚡", "🪦", "🩻", "☠️"]],
	["techno", ["💀", "⚙️", "🔩", "🔗", "⛓️", "🔪", "⚡", "🩻", "☠️"]],
	["dark", ["💀", "☠️", "🦴", "⚰️", "🪦", "🩸", "🔪", "⛓️", "⚡", "👁️", "🧠"]],
]
const FALLBACK := ["💀", "⚡", "🩻", "⛓️", "🌑", "👁️"]
const KEY := 0
const SET := 1

static func set_for(mood: String) -> Array:
	var id := mood.to_lower()
	for entry in MOODS:
		if id.contains(entry[KEY]):
			return entry[SET]
	return FALLBACK
