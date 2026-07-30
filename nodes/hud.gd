class_name Hud extends CanvasLayer
## Minimal combat HUD: crosshair, score, streak-announce banner, respawn indicator.
## Reads the human player + match each frame; styled skinning/kill-feed come later.

const BANNER_TIME := 2.0
const HUMAN_ID := 0
const BOT_ID := 1

var _human: PlayerNode
var _match: MatchNode
var _crosshair: Label
var _score: Label
var _banner: Label
var _respawn: Label
var _countdown: Label
var _banner_time := 0.0

func setup(human: PlayerNode, match_node: MatchNode) -> void:
	_human = human
	_match = match_node
	_match.frag.connect(_on_frag)

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

func _label(font_size: int) -> Label:
	var l := Label.new()
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	l.add_theme_font_size_override("font_size", font_size)
	return l

func _process(delta: float) -> void:
	if _human == null or _match == null:
		return
	_score.text = HudModel.score_line(_match.score_of(HUMAN_ID), _match.score_of(BOT_ID))
	var cd := _match.countdown_label()
	_countdown.text = cd
	_countdown.visible = cd != ""
	var ghost: bool = _human.player.respawning
	_respawn.visible = ghost and cd == ""
	_crosshair.visible = (not ghost) and cd == ""
	if _banner_time > 0.0:
		_banner_time = maxf(0.0, _banner_time - delta)
		if _banner_time == 0.0:
			_banner.visible = false

func _on_frag(shooter_id: int, _victim_id: int, streak: int, first_blood: bool) -> void:
	var text := HudModel.banner_for(shooter_id == HUMAN_ID, streak, first_blood)
	if text != "":
		_banner.text = text
		_banner.visible = true
		_banner_time = BANNER_TIME
