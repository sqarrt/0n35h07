class_name TrailerScreen extends Node
## The built-in trailer — port of web components/trailer/TrailerScreen + TrailerSequencer: the TrailerEdl shots in order
## over #05070d — the 3-2-1 countdown over emptiness (full-volume ticks, GO starting the trailer's music), text cuts, play
## shots (a DemoPlayback each under an opaque cover that fades once the scene has warmed up, its sounds at 0.45, GO just
## ahead of every later cut, the streak banner outliving the shot) and the finale's title card, the music ringing out
## under it. Always in English; the cursor and SKIP hide after 2.5 s without mouse movement; SKIP or Esc leaves early.

signal done

const SFX_GAIN := 0.45                         # web TRAILER_SFX_GAIN: game sounds dimmed, the music slightly ahead
const COUNTDOWN_SFX_GAIN := 1.0                # web COUNTDOWN_SFX_GAIN
const CURSOR_IDLE_S := 2.5                     # web CURSOR_IDLE_MS
const COUNTDOWN_STEPS := 3
const COVER_FADE_S := 0.25                     # .trailer-cover transition: opacity 0.25s ease
const EASE := [0.25, 0.1, 0.25, 1.0]           # CSS `ease`
const TITLE_AT_S := 3.6                        # web: the title surfaces (and the music stops) once the beams freeze
const FINALE_END_S := 9.0                      # web: the finale's fallback exit
const LOCALE := "en"                           # web ForceLocale id="en": the trailer speaks to the Steam audience
const LAYER := 20                              # over the replay HUD (web: the .trailer-root overlays stack above it)
const MS_PER_S := 1000.0
const BACKGROUND := Color("#05070d")           # .trailer-root
const COVER_COLOR := Color("#04060c")          # .trailer-cover
const FINALE_BACKGROUND := Color("#04050a")    # web FinaleView clear colour
const PAUSE_ACTION := "pause"                  # Esc

@export_file("*.tscn") var exit_scene := ""    # where the trailer leads when it is done ("" = nowhere: tests, tools)
var start_index := 0                           # web __debugTrailerShot: the shot the sequence starts at
## Plays a game sound at a gain (the SFX engine; tests record instead).
var play_sound: Callable

var _clips := {}
var _index := -1
var _elapsed := 0.0
var _held := false
var _hold_s := 0.0
var _finished := false
var _count := COUNTDOWN_STEPS
var _playback: DemoPlayback
var _cover_fade := CssTransition.new(COVER_FADE_S, EASE)
var _idle := true
var _idle_left := 0.0
var _saved_locale := ""
var _layer: CanvasLayer
var _background: ColorRect
var _countdown: HudCountdown
var _title: TrailerTitleCard
var _banner: HudStreakBanner
var _cover: ColorRect
var _cut: TrailerCutView
var _skip: TrailerSkipButton

func _init() -> void:
	play_sound = _play_sfx

func _ready() -> void:
	_saved_locale = I18n.locale()
	I18n.use_locale(LOCALE)
	Audio.stop_menu_music()                    # web App: no menu music on the trailer screen
	for id in TrailerEdl.clips():
		_clips[id] = DemoClip.load_clip(id)
	_layer = CanvasLayer.new()
	_layer.name = "Overlay"
	_layer.layer = LAYER
	add_child(_layer)
	_background = _full_rect("Background", BACKGROUND)
	_countdown = HudCountdown.new()
	_layer.add_child(_countdown)
	_title = TrailerTitleCard.new()
	_layer.add_child(_title)
	_banner = HudStreakBanner.new()
	_layer.add_child(_banner)
	_cover = _full_rect("Cover", COVER_COLOR)
	_cut = TrailerCutView.new()
	_layer.add_child(_cut)
	_skip = TrailerSkipButton.new()
	_layer.add_child(_skip)
	_skip.pressed.connect(finish)
	_set_idle(true)
	_enter(start_index)
	if _held:
		_seek(_hold_s)

func _exit_tree() -> void:
	I18n.use_locale(_saved_locale)
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	Audio.stop_trailer_music()                 # web unmount: music.stop(), disposed after the echo tail

## Parity frames (web __debugTrailerShot + __debugTrailerHoldMs): start at shot `index` with its clock held at `ms`.
func hold_at(index: int, ms: float) -> void:
	start_index = index
	_held = true
	_hold_s = ms / MS_PER_S

## SKIP, Esc or the end of the sequence (web finish → onDone → the ABOUT screen): once.
func finish() -> void:
	if _finished:
		return
	_finished = true
	Audio.stop_trailer_music()
	done.emit()
	if exit_scene != "":
		get_tree().change_scene_to_file.call_deferred(exit_scene)

## A mouse move shows the cursor and SKIP for CURSOR_IDLE_S (web wake).
func wake() -> void:
	_idle_left = CURSOR_IDLE_S
	_set_idle(false)

func shot_index() -> int:
	return _index

func playback() -> DemoPlayback:
	return _playback

func countdown() -> HudCountdown:
	return _countdown

func cut() -> TrailerCutView:
	return _cut

func cover() -> ColorRect:
	return _cover

func title_card() -> TrailerTitleCard:
	return _title

func banner() -> HudStreakBanner:
	return _banner

func skip_button() -> TrailerSkipButton:
	return _skip

func is_idle() -> bool:
	return _idle

func _input(event: InputEvent) -> void:
	if event is InputEventMouseMotion:
		wake()
	elif event.is_action_pressed(PAUSE_ACTION):
		finish()
		get_viewport().set_input_as_handled()

func _process(delta: float) -> void:
	_tick_idle(delta)
	_skip.tick(delta)
	_banner.tick(delta)
	if _finished or _index >= TrailerEdl.SHOTS.size():
		return
	var clock := 0.0 if _held else delta     # a held parity frame freezes only the shot's own clock
	_elapsed += clock
	var shot := _shot()
	match String(shot["type"]):
		TrailerEdl.COUNTDOWN:
			_countdown.tick(clock)
			_countdown_step()
			if _elapsed >= float(shot["duration_ms"]) / MS_PER_S:
				play_sound.call(MatchAudioCues.GO, COUNTDOWN_SFX_GAIN)
				Audio.play_trailer_music()       # web: the music starts after the countdown, straight at full
				_enter(_index + 1)
		TrailerEdl.TEXT:
			_cut.advance(clock)
			if _elapsed >= float(shot["duration_ms"]) / MS_PER_S:
				_enter(_index + 1)
		TrailerEdl.PLAY:
			_cover_fade.advance(delta)
			_cover.modulate.a = _cover_fade.value
		TrailerEdl.FINALE:
			if not _title.visible and _elapsed >= TITLE_AT_S:
				_title.show_card()
				Audio.stop_trailer_music()       # the fading music's echo rings under the title
			elif _title.visible:
				_title.advance(delta)
			if _elapsed >= FINALE_END_S:
				finish()

func _shot() -> Dictionary:
	return TrailerEdl.SHOTS[_index]

func _enter(index: int) -> void:
	_leave_play()
	_index = index
	_elapsed = 0.0
	if index >= TrailerEdl.SHOTS.size():
		finish()
		return
	var shot := _shot()
	var type := String(shot["type"])
	_background.visible = type != TrailerEdl.PLAY   # a play shot's canvas clears the screen itself
	_background.color = FINALE_BACKGROUND if type == TrailerEdl.FINALE else BACKGROUND
	_countdown.visible = type == TrailerEdl.COUNTDOWN
	_cut.visible = type == TrailerEdl.TEXT
	_cover.visible = type == TrailerEdl.PLAY
	_title.visible = false
	match type:
		TrailerEdl.COUNTDOWN:
			_count = COUNTDOWN_STEPS
			_countdown.set_number(str(_count))
			play_sound.call(MatchAudioCues.COUNT_TICK, COUNTDOWN_SFX_GAIN)
		TrailerEdl.TEXT:
			_cut.start(shot["text"], shot["duration_ms"])
		TrailerEdl.PLAY:
			_start_play(shot)

## Each play shot builds its own scene behind the opaque cover (web ShotView keyed by the shot index).
func _start_play(shot: Dictionary) -> void:
	_cover_fade.snap(1.0)
	_cover.modulate.a = _cover_fade.value
	_playback = DemoPlayback.new()
	_playback.setup(_clips[shot["clip"]], shot["ranges"], String(Game.profile.get("reserveColor", "")))
	_playback.sound.connect(func(event: String) -> void: play_sound.call(event, SFX_GAIN))
	_playback.ready_to_show.connect(_cover_fade.set_target.bind(0.0))
	_playback.near_end.connect(_on_near_end)
	_playback.ended.connect(func() -> void: _enter(_index + 1))
	_playback.announced.connect(_banner.announce)
	add_child(_playback)
	if _held:
		_playback.hold()

func _leave_play() -> void:
	if _playback == null:
		return
	_playback.process_mode = Node.PROCESS_MODE_DISABLED   # no late signals from a shot on its way out
	_playback.queue_free()
	_playback = null

## web onSceneNearEnd: GO slightly ahead of a cut, so its peak lands on the text slam (not before the first cut).
func _on_near_end() -> void:
	var next := _index + 1
	if next < TrailerEdl.SHOTS.size() and TrailerEdl.SHOTS[next]["type"] == TrailerEdl.TEXT \
			and next != TrailerEdl.first_text_index():
		play_sound.call(MatchAudioCues.GO, COUNTDOWN_SFX_GAIN)

## The number for the countdown clock: 3, 2, 1 a third of the shot each, a tick and a fresh pop on every change.
func _countdown_step() -> void:
	var per := float(_shot()["duration_ms"]) / MS_PER_S / COUNTDOWN_STEPS
	var count := COUNTDOWN_STEPS - mini(floori(_elapsed / per), COUNTDOWN_STEPS - 1)
	if count == _count:
		return
	_count = count
	_countdown.set_number(str(count))
	play_sound.call(MatchAudioCues.COUNT_TICK, COUNTDOWN_SFX_GAIN)

func _seek(elapsed_s: float) -> void:
	_elapsed = elapsed_s
	match String(_shot()["type"]):
		TrailerEdl.COUNTDOWN:
			_countdown_step()
			var per := float(_shot()["duration_ms"]) / MS_PER_S / COUNTDOWN_STEPS
			_countdown.tick(elapsed_s - (COUNTDOWN_STEPS - _count) * per)
		TrailerEdl.TEXT:
			_cut.advance(elapsed_s)

func _tick_idle(delta: float) -> void:
	if _idle:
		return
	_idle_left -= delta
	if _idle_left <= 0.0:
		_set_idle(true)

func _set_idle(idle: bool) -> void:
	_idle = idle
	_skip.set_idle(idle)
	Input.mouse_mode = Input.MOUSE_MODE_HIDDEN if idle else Input.MOUSE_MODE_VISIBLE

func _play_sfx(event: String, gain: float) -> void:
	Audio.sfx().play_2d(event, gain)

func _full_rect(node_name: String, color: Color) -> ColorRect:
	var rect := ColorRect.new()
	rect.name = node_name
	rect.color = color
	rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
	rect.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_layer.add_child(rect)
	return rect
