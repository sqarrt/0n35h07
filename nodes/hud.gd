class_name Hud extends CanvasLayer
## Match HUD — port of web GameOverlay (1v1): top bar with frags and the timer, beam-cooldown crosshair ring,
## shield corner brackets and dash side bars; the combat HUD shows only while live (web hides it during the
## countdown). The streak banner, respawn indicator and countdown number get their web styling in H2.

const BANNER_TIME := 2.0
const HUMAN_ID := 0
const BOT_ID := 1
const BANNER_FONT_SIZE := 48
const BANNER_OFFSET_TOP := 120
const BANNER_COLOR := Color(1.0, 0.85, 0.2)
const RESPAWN_TEXT := "RESPAWNING…"
const RESPAWN_FONT_SIZE := 32
const RESPAWN_COLOR := Color(1.0, 0.4, 0.4)
const COUNTDOWN_FONT_SIZE := 96

var _human: PlayerNode
var _match: MatchNode
var _top_bar: HudTopBar
var _crosshair: HudCrosshair
var _brackets: HudShieldBrackets
var _dash: HudDashBars
var _banner: Label
var _respawn: Label
var _countdown: Label
var _banner_time := 0.0

func setup(human: PlayerNode, match_node: MatchNode) -> void:
	_human = human
	_match = match_node
	_match.frag.connect(_on_frag)
	_match.match_ended.connect(_on_match_ended)

## The match-end screen replaces the HUD (web GameOverlay renders the HUD only while there is no result).
func _on_match_ended(_result: Dictionary) -> void:
	visible = false

func _ready() -> void:
	_brackets = HudShieldBrackets.new()
	add_child(_brackets)
	_dash = HudDashBars.new()
	add_child(_dash)
	_crosshair = HudCrosshair.new()
	add_child(_crosshair)
	_top_bar = HudTopBar.new()
	add_child(_top_bar)

	_banner = _label(BANNER_FONT_SIZE)
	_banner.set_anchors_preset(Control.PRESET_FULL_RECT)
	_banner.vertical_alignment = VERTICAL_ALIGNMENT_TOP
	_banner.offset_top = BANNER_OFFSET_TOP
	_banner.modulate = BANNER_COLOR
	_banner.visible = false
	add_child(_banner)

	_respawn = _label(RESPAWN_FONT_SIZE)
	_respawn.text = RESPAWN_TEXT
	_respawn.set_anchors_preset(Control.PRESET_FULL_RECT)
	_respawn.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	_respawn.modulate = RESPAWN_COLOR
	_respawn.visible = false
	add_child(_respawn)

	_countdown = _label(COUNTDOWN_FONT_SIZE)
	_countdown.set_anchors_preset(Control.PRESET_FULL_RECT)
	_countdown.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	_countdown.visible = false
	add_child(_countdown)

func _label(font_size: int) -> Label:
	var l := Label.new()
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	l.add_theme_font_override("font", UiFont.base())
	l.add_theme_font_size_override("font_size", font_size)
	return l

func _process(delta: float) -> void:
	if _human == null or _match == null:
		return
	var player := _human.player
	var cd := _match.countdown_label()
	var live := cd == ""
	_countdown.text = cd
	_countdown.visible = not live
	for element in [_top_bar, _crosshair, _brackets, _dash]:
		element.visible = live
	_top_bar.set_state(_match.score_of(HUMAN_ID), _match.score_of(BOT_ID), HudModel.match_time(_match.seconds_left()))
	_crosshair.set_progress(player.beam_progress())
	_brackets.set_state(player.shield_progress(), player.is_shielded())
	_dash.set_progress(player.dash_progress())
	_respawn.visible = live and player.respawning
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
