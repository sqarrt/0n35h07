class_name MatchAudio extends Node
## A match's sound — web Match's audio duties: every player's SFX transitions each physics tick (MatchSfx, which keeps
## running after the end as the web update does), combat events voiced as they resolve, the countdown ticks and GO,
## streak announces, the seeded match music from GO to the end (web MatchMusic) with its fade-out, and the SFX reset.
## The music seed is a room-code-like code (web: the room creator's code), hashed like the web.

const MUSIC_BUS := "MatchMusic"
const MANIFEST := "res://assets/audio/music/manifest.json"
const DEFAULT_WINDUP := "classic"
const READY := 1.0                                 # a cooldown progress of 1 means ready

var seed_code := ""                               # set before setup to share a seed; empty = a local random code
var music_enabled := true                         # false: the radio is the soundtrack (web radioForMatch)

var _match: MatchNode
var _players: Array = []                          # PlayerNode
var _local_id := 0
var _sfx: MatchSfx
var _cues := MatchAudioCues.new()
var _director := MusicDirector.new()
var _library := {}
var _seed := 0
var _music: MusicEngine
var _music_capture: AudioEffectCapture         # kept: the engine's buses are gone by the time this node exits

func setup(match_node: MatchNode, players: Array, local_id: int, world: Node3D) -> void:
	_match = match_node
	_players = players
	_local_id = local_id
	Audio.sfx().world_parent = world
	_sfx = MatchSfx.new(Audio.sfx())
	if seed_code == "":
		seed_code = Audio.random_room_code(Game.random.randf)
	_seed = MusicRng.hash_seed(seed_code)
	_library = JSON.parse_string(FileAccess.get_file_as_string(MANIFEST))["roles"]
	match_node.combat_event.connect(func(event: Dictionary) -> void: _sfx.combat(event, _position_of))
	match_node.frag.connect(_on_frag)

func music() -> MusicEngine:
	return _music

func _physics_process(_delta: float) -> void:
	if _match == null:
		return
	for cue in _cues.step(_match.countdown_label(), _match.is_live(), _match.is_ended()):
		match cue:
			MatchAudioCues.COUNT_TICK:
				_sfx.play_2d(cue)
			MatchAudioCues.GO:
				_sfx.play_2d(cue)
				if music_enabled:
					_start_music()
			MatchAudioCues.ENDED:
				if _music != null:
					_music.fade_out()
				_sfx.reset()
	_sfx.frame(_inputs(), Time.get_ticks_msec())

func _exit_tree() -> void:
	if _music_capture != null:   # children exit first, so never look the bus up again here
		Audio.analysis.remove_capture(_music_capture)
		_music_capture = null
	if _sfx != null:
		_sfx.reset()
	Audio.sfx().world_parent = null

func _start_music() -> void:
	_music = MusicEngine.new()
	_music.name = "MatchMusic"
	_music.bus_prefix = MUSIC_BUS
	_music.setup(func(loop: int) -> Array: return _director.compose(_seed, loop, _library, _match.remaining_ms()))
	add_child(_music)
	_music.set_user_gain(Audio.music_gain())
	_music.start()
	_music_capture = _music.capture()
	Audio.analysis.add_capture(_music_capture)

func _on_frag(_shooter_id: int, _victim_id: int, streak: int, first_blood: bool) -> void:
	var event := MatchAudioCues.announce_event(Streak.announce_kind(streak, first_blood))
	if event != "":
		_sfx.play_2d(event)

## web sfxFrameOwned: every player is simulated locally, so every player has fresh transitions.
func _inputs() -> Array:
	var inputs := []
	for node in _players:
		var player: Player = node.player
		var local: bool = player.id == _local_id
		inputs.append({"id": player.id, "target": node, "pos": node.global_position,
			"shield_active": player.is_shielded(), "dashing": player.body.is_dashing(),
			"grounded": player.body.grounded, "just_jumped": player.body.just_jumped,
			"dash_ready": player.dash_progress() >= READY if local else null,
			"shield_ready": player.shield_progress() >= READY if local else null,
			"winding_up": player.is_winding_up(),
			"windup_style": _match.roster.entry(player.id).get("windupStyle", DEFAULT_WINDUP), "is_local": local})
	return inputs

func _position_of(id: int):
	for node in _players:
		if node.player.id == id:
			return node.global_position
	return null
