class_name RadioTrackName
## Track names — port of web src/radio/trackName.ts: human-but-machine, fully deterministic from the track seed. A seeded
## mulberry32 (xmur3-style string hash) picks the word family by mood, one of nine naming schemes and the words; names
## are intentionally not localized. JavaScript's 32-bit integer maths (Math.imul, >>>, |0) runs on GDScript's 64-bit
## ints; the draws happen in web's order, an array literal's draws before the pick that reads them. Oracle:
## web-reference scripts/export-radio-track-names.mjs.

const U32 := 0x100000000
const MASK32 := 0xFFFFFFFF
const SIGN32 := 0x80000000
const LOW16 := 0xFFFF
const HALF_WORD := 16
const HASH_START := 1779033703
const HASH_MUL := 3432918353
const ROTATE_LEFT := 13
const ROTATE_RIGHT := 19
const WEYL := 0x6D2B79F5
const SHIFT_A := 15
const SHIFT_B := 7
const SHIFT_C := 14
const MIX_B := 61
const SCHEMES := 9
const HEX_BYTE := 256
const HALF := 0.5
const MODEL_MIN := 10
const MODEL_SPAN := 90
const CATALOGUE_MIN := 1
const CATALOGUE_SPAN := 99
const DARK := "dark"
const DUB := "dub"
const ACID := "acid"
const DEFAULT := "default"

const ADJ := {
	DARK: ["Iron", "Ashen", "Null", "Cold", "Black", "Static", "Concrete", "Leaden", "Grim", "Severed", "Rust", "Hollow",
		"Brutal", "Charred", "Frozen", "Buried", "Shattered", "Molten", "Tarnished", "Obsidian", "Fractured", "Sunless",
		"Bleak", "Vile", "Forsaken", "Wretched", "Withered", "Gaunt", "Sullen", "Bitter", "Carrion", "Dread", "Ferric",
		"Slate", "Granite", "Murderous", "Funeral", "Sepulchral", "Onyx", "Sable", "Dire", "Stark", "Scorched", "Choked",
		"Riven", "Ravaged", "Hardened", "Profane", "Unhallowed", "Ironclad",
		"Cindered", "Ironbound", "Desolate", "Wracked", "Smouldering", "Calcified", "Mournful", "Sundered", "Blighted",
		"Abyssal", "Vengeful", "Merciless", "Ashfallen", "Coldforged", "Lightless", "Necrotic", "Tyrant", "Godless"],
	DUB: ["Sunken", "Grey", "Distant", "Dim", "Damp", "Murky", "Deep", "Drowned", "Faded", "Quiet",
		"Hazy", "Hushed", "Brackish", "Stagnant", "Frigid", "Glacial", "Submerged", "Bottomless", "Vacant", "Pallid",
		"Wan", "Listless", "Muted", "Veiled", "Shrouded", "Nebulous", "Drifting", "Vacuous", "Tenebrous", "Liminal",
		"Subaqueous", "Fathomless", "Becalmed", "Forlorn", "Sodden", "Overcast",
		"Tidal", "Phantom", "Echoing", "Sleepless", "Cavernous", "Underlit", "Saltworn", "Driftless", "Lowlit",
		"Tempered", "Moonless", "Tideless", "Sightless", "Becalming", "Slumbering", "Wraithlike"],
	ACID: ["Caustic", "Toxic", "Bright", "Corrosive", "Acrid", "Volatile", "Neon", "Raw",
		"Acidic", "Searing", "Blistering", "Septic", "Virulent", "Noxious", "Fuming", "Lurid", "Garish", "Electric",
		"Livid", "Feral", "Rabid", "Seething", "Writhing", "Mutant", "Radiant", "Bilious", "Putrid", "Rancid",
		"Twitching", "Glowing", "Effervescent", "Unstable", "Reactive", "Corroded",
		"Sizzling", "Vitriolic", "Scalding", "Festering", "Galvanic", "Plasmic", "Corroding", "Bubbling", "Irradiated",
		"Mutagenic", "Phosphoric", "Hyperactive", "Synthetic", "Blinding", "Venomous", "Fissile"],
	DEFAULT: ["Grey", "Hollow", "Distant", "Cold", "Static", "Faint", "Pale",
		"Blank", "Vacant", "Null", "Drifting", "Muted", "Idle", "Latent", "Dormant", "Spare", "Flat", "Dull", "Stray",
		"Lone", "Vague", "Inert", "Neutral", "Sparse",
		"Spent", "Adrift", "Minor", "Lapsed", "Tepid", "Plain", "Slack", "Numb", "Stale", "Drab"],
}
const NOUN := {
	DARK: ["Verdict", "Reactor", "Anvil", "Spire", "Cathedral", "Pyre", "Sector", "Engine", "Vault", "Wraith", "Mass",
		"Saint", "Forge", "Cell", "Furnace", "Crucible", "Monolith", "Obelisk", "Gallows", "Sepulchre", "Ossuary",
		"Reliquary", "Bastion", "Citadel", "Bunker", "Conduit", "Turbine", "Piston", "Girder", "Chassis", "Husk", "Relic",
		"Idol", "Effigy", "Shroud", "Tomb", "Crypt", "Catacomb", "Altar", "Dirge", "Knell", "Requiem", "Sermon", "Doctrine",
		"Decree", "Tribunal", "Gauntlet", "Maw", "Scourge", "Edifice",
		"Mandate", "Sanctum", "Ordeal", "Reckoning", "Cortege", "Sarcophagus", "Inquisition", "Slaughterhouse", "Hangman",
		"Mausoleum", "Charnel", "Gibbet", "Pulpit", "Cenotaph", "Reckoner", "Warden", "Dominion", "Threshold"],
	DUB: ["Hollow", "Fathom", "Chamber", "Murk", "Abyss", "Cinder", "Mist", "Drift", "Tide", "Cavern",
		"Trench", "Gulf", "Void", "Expanse", "Depths", "Shoal", "Undertow", "Maelstrom", "Vortex", "Eddy", "Lull", "Hush",
		"Penumbra", "Gloom", "Haze", "Vapor", "Sediment", "Silt", "Brine", "Current", "Wake", "Threshold", "Limbo",
		"Strata", "Hollows", "Quagmire", "Estuary",
		"Fjord", "Basin", "Lagoon", "Sluice", "Backwater", "Drainage", "Spillway", "Cistern", "Aquifer", "Floe",
		"Reservoir", "Murmur", "Subsidence", "Hollowness", "Seabed", "Nightfall"],
	ACID: ["Bloom", "Coil", "Serum", "Worm", "Vat", "Loop", "Spore", "Reagent", "Toxin",
		"Solvent", "Enzyme", "Culture", "Strain", "Mutation", "Membrane", "Synapse", "Tendril", "Larva", "Hive", "Swarm",
		"Catalyst", "Compound", "Residue", "Effluent", "Sludge", "Ichor", "Venom", "Bile", "Pustule", "Filament", "Reactor",
		"Petri", "Beaker", "Isotope", "Slime",
		"Reactant", "Polymer", "Plasmid", "Pathogen", "Toxoid", "Distillate", "Precipitate", "Catalyzer", "Genome",
		"Spawnpool", "Outbreak", "Contagion", "Vector", "Petridish", "Nutrient", "Bioreactor"],
	DEFAULT: ["Signal", "Drift", "Channel", "Loop", "Phase", "Vector", "Echo", "Frame",
		"Pulse", "Node", "Array", "Cipher", "Relay", "Circuit", "Lattice", "Matrix", "Conduit", "Beacon", "Fragment",
		"Sequence", "Pattern", "Cycle", "Glitch", "Vapor", "Strobe", "Filter",
		"Routine", "Kernel", "Buffer", "Register", "Token", "Packet", "Stream", "Index", "Schema", "Daemon"],
}
const MODEL := ["9X", "RT", "S7", "MK2", "AX2", "D3", "XS", "V2", "HX", "RS", "TR", "CV", "FX", "Z9", "Q4", "NX", "EX",
	"K7", "P1", "GX"]
const GREEK := ["Alpha", "Beta", "Gamma", "Delta", "Theta", "Sigma", "Omega", "Kappa", "Lambda", "Zeta", "Phi", "Psi",
	"Chi", "Tau", "Rho", "Xi", "Eta", "Mu", "Nu", "Pi"]
const ROMAN := ["II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "XI", "XIII", "XV", "XVII", "XIX", "XX", "XXX", "XL"]

## mulberry32 seeded from a string (xmur3-style hash), as web makeRng.
class Rng:
	var _state := 0

	func _init(seed: String) -> void:
		var h := RadioTrackName.i32(RadioTrackName.HASH_START ^ seed.length())
		for i in seed.length():
			h = RadioTrackName.imul(RadioTrackName.i32(h ^ seed.unicode_at(i)), RadioTrackName.HASH_MUL)
			var u := RadioTrackName.u32(h)
			h = RadioTrackName.i32((u << RadioTrackName.ROTATE_LEFT) | (u >> RadioTrackName.ROTATE_RIGHT))
		_state = RadioTrackName.u32(h)

	func next() -> float:
		_state = RadioTrackName.i32(_state + RadioTrackName.WEYL)
		var a := RadioTrackName.u32(_state)
		var t := RadioTrackName.imul(RadioTrackName.i32(a ^ (a >> RadioTrackName.SHIFT_A)), RadioTrackName.i32(a | 1))
		var ut := RadioTrackName.u32(t)
		var mixed := RadioTrackName.imul(RadioTrackName.i32(ut ^ (ut >> RadioTrackName.SHIFT_B)),
			RadioTrackName.i32(ut | RadioTrackName.MIX_B))
		t = RadioTrackName.i32(RadioTrackName.u32(t + mixed) ^ ut)
		ut = RadioTrackName.u32(t)
		return float(RadioTrackName.u32(ut ^ (ut >> RadioTrackName.SHIFT_C))) / RadioTrackName.U32

## web radioTrackName({mood, bpm, key, trackSeed}).
static func of(mood: String, bpm: float, key: String, track_seed: String) -> String:
	var rng := Rng.new(track_seed)
	var family := family_of(mood)
	var adj: String = _pick(ADJ[family], rng.next())
	var noun: String = _pick(NOUN[family], rng.next())
	var tempo := number_text(bpm)
	match floori(rng.next() * SCHEMES):
		0:   # hybrid: word(s) + a short machine tag
			var hex := _hex2(rng.next())
			var tag: String = _pick(["// %s" % key, "· %s" % tempo, "-%s" % hex, "[%s]" % key, "/%s" % tempo], rng.next())
			return "%s %s %s" % [adj, noun, tag]
		1:   # two-word machine poetry
			return "%s %s" % [adj, noun]
		2:   # protocol / process
			return _pick(["PROTOCOL: " + noun.to_upper(), "proc/" + noun.to_lower(), "SYS." + noun.to_upper(),
				"daemon:" + noun.to_lower()], rng.next())
		3:   # model index
			var code: String = _pick(MODEL, rng.next()) if rng.next() < HALF \
				else "-%d" % (MODEL_MIN + floori(rng.next() * MODEL_SPAN))
			return noun + code if code.begins_with("-") else "%s %s" % [noun, code]
		4:   # a greek-letter designation
			var first: String = _pick(GREEK, rng.next())
			var second: String = _pick(GREEK, rng.next())
			var third: String = _pick(GREEK, rng.next())
			return _pick(["%s %s %s" % [adj, noun, first], "%s %s" % [noun, second], "%s %s" % [third, noun]], rng.next())
		5:   # a roman numeral
			var first: String = _pick(ROMAN, rng.next())
			var second: String = _pick(ROMAN, rng.next())
			var third: String = _pick(ROMAN, rng.next())
			return _pick(["%s %s %s" % [adj, noun, first], "%s — %s" % [noun, second], "%s %s mk.%s" % [adj, noun, third]],
				rng.next())
		6:   # a definite-article title
			return _pick(["The %s %s" % [adj, noun], "The %s" % noun, "The %s of %s" % [noun, adj]], rng.next())
		7:   # a noun-noun compound
			var noun2: String = _pick(NOUN[family], rng.next())
			return _pick(["%s %s" % [noun, noun2], "%s//%s" % [noun, noun2], "%s-%s" % [noun, noun2]], rng.next())
		_:   # a catalogue index
			var n := CATALOGUE_MIN + floori(rng.next() * CATALOGUE_SPAN)
			var model: String = _pick(MODEL, rng.next())
			return _pick(["%s %s No.%d" % [adj, noun, n], "%s %s·%d" % [noun, model, n], "%s no.%d" % [noun, n]], rng.next())

## The word family by mood, most specific first (acid_dark → acid, dub_techno → dub, dark_techno → dark).
static func family_of(mood: String) -> String:
	var m := mood.to_lower()
	if m.contains(ACID):
		return ACID
	for word in ["dub", "deep", "ambient", "hypnotic"]:
		if m.contains(word):
			return DUB
	for word in [DARK, "techno", "hard", "industrial"]:
		if m.contains(word):
			return DARK
	return DEFAULT

## A number as JavaScript prints it in a template: a whole JSON float without its ".0".
static func number_text(value: float) -> String:
	return str(int(value)) if value == floorf(value) else str(value)

static func u32(value: int) -> int:
	return value & MASK32

static func i32(value: int) -> int:
	var u := value & MASK32
	return u - U32 if u >= SIGN32 else u

## Math.imul: the low 32 bits of the product, in 16-bit halves so nothing overflows 64 bits.
static func imul(a: int, b: int) -> int:
	var ua := u32(a)
	var ub := u32(b)
	var low := (ua & LOW16) * ub
	var high := (((ua >> HALF_WORD) & LOW16) * ub) & LOW16
	return i32(low + (high << HALF_WORD))

static func _pick(words: Array, r: float) -> String:
	return words[mini(words.size() - 1, floori(r * words.size()))]

static func _hex2(r: float) -> String:
	return "%02x" % floori(r * HEX_BYTE)
