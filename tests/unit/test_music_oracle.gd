extends GutTest
## Music composition parity with the web sources, checked against tests/fixtures/music_oracle.json recorded by
## web-reference/scripts/parity-oracle-music.mjs: FNV-1a seeds, mulberry32, the stem order, 60 match loops for two
## seeds plus an outro, and the menu arrangement.

const FIXTURE := "res://tests/fixtures/music_oracle.json"
const EPS := 1e-9
const VOICE_KEYS := {"role": "role", "stemId": "stem_id", "gain": "gain", "doubleSec": "double_sec",
	"reverb": "reverb", "echo": "echo"}

var _oracle: Dictionary

func before_all() -> void:
	var json := JSON.new()
	assert_eq(json.parse(FileAccess.get_file_as_string(FIXTURE)), OK, "fixture parses")
	_oracle = json.data

func _library() -> Dictionary:
	return _oracle["library"]

func _assert_voices(actual: Array, expected: Array, where: String) -> void:
	assert_eq(actual.size(), expected.size(), "%s: voice count" % where)
	for i in mini(actual.size(), expected.size()):
		var want: Dictionary = expected[i]
		var got: Dictionary = actual[i]
		assert_eq(got.size(), want.size(), "%s voice %d: fields %s vs %s" % [where, i, got, want])
		for key in want:
			var mine: String = VOICE_KEYS[key]
			if want[key] is String:
				assert_eq(got.get(mine), want[key], "%s voice %d %s" % [where, i, key])
			else:
				assert_almost_eq(float(got.get(mine, NAN)), float(want[key]), EPS, "%s voice %d %s" % [where, i, key])

func test_seed_hashes_and_prng_match_the_web() -> void:
	for code in _oracle["hashes"]:
		assert_eq(MusicRng.hash_seed(code), int(_oracle["hashes"][code]), "hashSeed(%s)" % code)
	var rng := MusicRng.new(int(_oracle["prng"]["seed"]))
	for value in _oracle["prng"]["values"]:
		assert_almost_eq(rng.next(), float(value), EPS)

func test_match_loops_compose_like_the_web() -> void:
	var director := MusicDirector.new()
	for run in _oracle["compose"]:
		var seed := MusicRng.hash_seed(run["code"])
		var loops: Array = run["loops"]
		for i in loops.size():
			_assert_voices(director.compose(seed, i, _library(), INF), loops[i], "%s loop %d" % [run["code"], i])
		var outro: Dictionary = run["outro"]
		_assert_voices(director.compose(seed, int(outro["loop"]), _library(), float(outro["remainingMs"])),
			outro["voices"], "%s outro" % run["code"])

func test_menu_music_arranges_like_the_web() -> void:
	var menu_rng := MusicRng.new(int(_oracle["menu"]["rngSeed"]))   # a method Callable does not keep its object alive
	var arranger := MenuMusicArranger.new(menu_rng.as_callable())
	var loops: Array = _oracle["menu"]["loops"]
	for i in loops.size():
		_assert_voices(arranger.arrange(i), loops[i], "menu loop %d" % i)
