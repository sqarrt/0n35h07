extends SceneTree
## Dev probe for the music engine design: two role slots (AudioStreamPlayer + AudioStreamInteractive) started together
## under AudioServer.lock(); the kicks slot switches from one stem to another with a next-bar crossfade while a bass
## stem plays alongside. The Master bus is recorded to a WAV (tools/audio/analyse_probe.py finds where the switch
## lands and the fade shape) and an AudioEffectCapture on Master reports whether frames arrive.
##   <godot> --headless --path . -s tools/audio_probe.gd -- [output wav] [switch request s] [record s]

const DEFAULT_OUT := "res://test-results/probes/audio/interactive.wav"
const MANIFEST := "res://assets/audio/music/manifest.json"
const STEM_PATH := "res://assets/audio/music/%s.ogg"
const BASS_ID := "bass/kutting"
const LOOP_BEATS := 16                   # one bar = the whole 8-second loop
const FADE_BEATS := 0.24                 # 120 ms at 120 bpm (web CROSSFADE_SEC)
const DEFAULT_SWITCH_S := 4.0
const DEFAULT_RECORD_S := 20.0
const CLIP_A := &"a"
const CLIP_B := &"b"
const ARG_OUT := 0
const ARG_SWITCH := 1
const ARG_RECORD := 2

var _out := DEFAULT_OUT
var _switch_s := DEFAULT_SWITCH_S
var _record_s := DEFAULT_RECORD_S
var _elapsed := 0.0
var _started := false
var _switched := false
var _kicks: AudioStreamPlayer
var _bass: AudioStreamPlayer
var _record: AudioEffectRecord
var _capture: AudioEffectCapture
var _captured_frames := 0

func _initialize() -> void:
	var args := OS.get_cmdline_user_args()
	if args.size() > ARG_OUT:
		_out = args[ARG_OUT]
	if args.size() > ARG_SWITCH:
		_switch_s = float(args[ARG_SWITCH])
	if args.size() > ARG_RECORD:
		_record_s = float(args[ARG_RECORD])
	var manifest: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(MANIFEST))
	var kicks: Array = manifest["roles"]["kicks"]
	var master := AudioServer.get_bus_index("Master")
	_record = AudioEffectRecord.new()
	AudioServer.add_bus_effect(master, _record)
	_capture = AudioEffectCapture.new()
	AudioServer.add_bus_effect(master, _capture)
	var interactive := AudioStreamInteractive.new()
	interactive.clip_count = 2
	interactive.set_clip_stream(0, _bar_loop(kicks[0]))
	interactive.set_clip_name(0, CLIP_A)
	interactive.set_clip_stream(1, _bar_loop(kicks[1]))
	interactive.set_clip_name(1, CLIP_B)
	interactive.initial_clip = 0
	interactive.add_transition(AudioStreamInteractive.CLIP_ANY, AudioStreamInteractive.CLIP_ANY,
		AudioStreamInteractive.TRANSITION_FROM_TIME_NEXT_BAR, AudioStreamInteractive.TRANSITION_TO_TIME_START,
		AudioStreamInteractive.FADE_CROSS, FADE_BEATS)
	_kicks = AudioStreamPlayer.new()
	_kicks.stream = interactive
	root.add_child(_kicks)
	_bass = AudioStreamPlayer.new()
	_bass.stream = _bar_loop(BASS_ID)
	root.add_child(_bass)
	print("PROBE kicks %s -> %s, bass %s" % [kicks[0], kicks[1], BASS_ID])
	_record.set_recording_active(true)

func _process(delta: float) -> bool:
	if not _started:                     # nodes added in _initialize enter the tree only now
		_started = true
		AudioServer.lock()               # both slots start in the same mix
		_kicks.play()
		_bass.play()
		AudioServer.unlock()
		return false
	_elapsed += delta
	_captured_frames += _capture.get_frames_available()
	_capture.clear_buffer()
	if not _switched and _elapsed >= _switch_s:
		_switched = true
		var playback := _kicks.get_stream_playback() as AudioStreamPlaybackInteractive
		playback.switch_to_clip_by_name(CLIP_B)
		print("SWITCH_REQUESTED at %.3f s (playback %.3f s)" % [_elapsed, _kicks.get_playback_position()])
	if _elapsed < _record_s:
		return false
	_record.set_recording_active(false)
	var recording := _record.get_recording()
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(_out.get_base_dir()))
	var result := recording.save_to_wav(_out) if recording != null else ERR_UNAVAILABLE
	print("PROBE_SAVED %s (%s), mix rate %d, captured frames %d" % [ProjectSettings.globalize_path(_out),
		error_string(result), AudioServer.get_mix_rate(), _captured_frames])
	return true

func _bar_loop(stem_id: String) -> AudioStreamOggVorbis:
	var stream := (load(STEM_PATH % stem_id) as AudioStreamOggVorbis).duplicate() as AudioStreamOggVorbis
	stream.bar_beats = LOOP_BEATS
	return stream
