class_name Hud extends CanvasLayer
## Minimal combat HUD: crosshair, score, match timer, streak-announce banner, respawn indicator.
## Reads the human player + match each frame; styled skinning/kill-feed come later.

const BANNER_TIME := 2.0
const HUMAN_ID := 0
const BOT_ID := 1
const TIMER_FONT_SIZE := 22
const TIMER_OFFSET_TOP := 46   # just under the score line

var _human: PlayerNode
var _match: MatchNode
var _crosshair: Label
var _score: Label
var _timer: Label
var _banner: Label
var _respawn: Label
var _countdown: Label
var _beam_bar: ProgressBar
var _shield_bar: ProgressBar
var _dash_bar: ProgressBar
var _speed: Label
var _feed: VBoxContainer
var _banner_time := 0.0
const FEED_LINE_TIME := 4.0

func setup(human: PlayerNode, match_node: MatchNode) -> void:
	_human = human
	_match = match_node
	_match.frag.connect(_on_frag)
	_match.match_ended.connect(_on_match_ended)

## The match-end screen replaces the HUD (web GameOverlay renders the HUD only while there is no result).
func _on_match_ended(_result: Dictionary) -> void:
	visible = false

func _ready() -> void:
	_crosshair = _label(28)
	_crosshair.text = "+"
	_crosshair.set_anchors_preset(Control.PRESET_FULL_RECT)
	_crosshair.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	add_child(_crosshair)

	_score = _label(24)
	_score.set_anchors_preset(Control.PRESET_TOP_WIDE)
	_score.offset_top = 12
	add_child(_score)

	_timer = _label(TIMER_FONT_SIZE)
	_timer.set_anchors_preset(Control.PRESET_TOP_WIDE)
	_timer.offset_top = TIMER_OFFSET_TOP
	add_child(_timer)

	_banner = _label(48)
	_banner.set_anchors_preset(Control.PRESET_FULL_RECT)
	_banner.vertical_alignment = VERTICAL_ALIGNMENT_TOP
	_banner.offset_top = 120
	_banner.modulate = Color(1.0, 0.85, 0.2)
	_banner.visible = false
	add_child(_banner)

	_respawn = _label(32)
	_respawn.text = "RESPAWNING…"
	_respawn.set_anchors_preset(Control.PRESET_FULL_RECT)
	_respawn.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	_respawn.modulate = Color(1.0, 0.4, 0.4)
	_respawn.visible = false
	add_child(_respawn)

	_countdown = _label(96)
	_countdown.set_anchors_preset(Control.PRESET_FULL_RECT)
	_countdown.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	_countdown.visible = false
	add_child(_countdown)

	var row := HBoxContainer.new()
	row.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	row.offset_top = -52
	row.add_theme_constant_override("separation", 20)
	add_child(row)
	_beam_bar = _bar(row, "BEAM")
	_shield_bar = _bar(row, "SHIELD")
	_dash_bar = _bar(row, "DASH")

	_feed = VBoxContainer.new()
	_feed.set_anchors_preset(Control.PRESET_TOP_RIGHT)
	_feed.alignment = BoxContainer.ALIGNMENT_END
	_feed.offset_left = -280
	_feed.offset_top = 12
	_feed.offset_right = -14
	add_child(_feed)

	_speed = _label(18)
	_speed.set_anchors_preset(Control.PRESET_BOTTOM_LEFT)
	_speed.horizontal_alignment = HORIZONTAL_ALIGNMENT_LEFT
	_speed.offset_left = 16
	_speed.offset_top = -32
	add_child(_speed)

func _bar(parent: Node, label_text: String) -> ProgressBar:
	var v := VBoxContainer.new()
	var lbl := Label.new()
	lbl.text = label_text
	lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	lbl.add_theme_font_size_override("font_size", 12)
	v.add_child(lbl)
	var bar := ProgressBar.new()
	bar.min_value = 0.0
	bar.max_value = 1.0
	bar.value = 1.0
	bar.show_percentage = false
	bar.custom_minimum_size = Vector2(120, 14)
	v.add_child(bar)
	parent.add_child(v)
	return bar

func _label(font_size: int) -> Label:
	var l := Label.new()
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	l.add_theme_font_size_override("font_size", font_size)
	return l

func _process(delta: float) -> void:
	if _human == null or _match == null:
		return
	_score.text = HudModel.score_line(_match.score_of(HUMAN_ID), _match.score_of(BOT_ID))
	_timer.text = HudModel.match_time(_match.seconds_left())
	var cd := _match.countdown_label()
	_countdown.text = cd
	_countdown.visible = cd != ""
	var ghost: bool = _human.player.respawning
	_respawn.visible = ghost and cd == ""
	_crosshair.visible = (not ghost) and cd == ""
	_beam_bar.value = _human.player.beam_progress()
	_shield_bar.value = _human.player.shield_progress()
	_dash_bar.value = _human.player.dash_progress()
	_speed.text = "%d u/s" % int(round(_human.player.speed()))
	if _banner_time > 0.0:
		_banner_time = maxf(0.0, _banner_time - delta)
		if _banner_time == 0.0:
			_banner.visible = false

func _on_frag(shooter_id: int, victim_id: int, streak: int, first_blood: bool) -> void:
	var text := HudModel.banner_for(shooter_id == HUMAN_ID, streak, first_blood)
	if text != "":
		_banner.text = text
		_banner.visible = true
		_banner_time = BANNER_TIME
	# Kill feed line (auto-removed after a few seconds).
	var line := Label.new()
	line.text = HudModel.frag_line(shooter_id, victim_id)
	line.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	line.add_theme_font_size_override("font_size", 18)
	_feed.add_child(line)
	get_tree().create_timer(FEED_LINE_TIME).timeout.connect(line.queue_free)
