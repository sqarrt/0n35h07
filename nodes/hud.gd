class_name Hud extends CanvasLayer
## Match HUD — port of web GameOverlay (1v1): screen vignettes and flash tints, top bar with frags and the timer,
## beam-cooldown crosshair ring, shield corner brackets, dash side bars, the streak banner and the ghost-phase bars.
## The combat HUD shows only while live; during the countdown the web shows just the dim veil and the number.

const HUMAN_ID := 0
const BOT_ID := 1

var _human: PlayerNode
var _match: MatchNode
var _overlay: HudOverlayFx
var _top_bar: HudTopBar
var _crosshair: HudCrosshair
var _brackets: HudShieldBrackets
var _dash: HudDashBars
var _ghost: HudGhostIndicator
var _banner: HudStreakBanner
var _countdown: HudCountdown

func setup(human: PlayerNode, match_node: MatchNode) -> void:
	_human = human
	_match = match_node
	_match.frag.connect(_on_frag)
	_match.fired.connect(_on_fired)
	_match.blocked.connect(_on_blocked)
	_match.match_ended.connect(_on_match_ended)
	_top_bar.set_players(_match.roster.entry(HUMAN_ID), _match.roster.opponent_of(HUMAN_ID))

## The match-end screen replaces the HUD (web GameOverlay renders the HUD only while there is no result).
func _on_match_ended(_result: Dictionary) -> void:
	visible = false

func _ready() -> void:
	# Draw order follows the web z-index: vignettes (9-10) under the crosshair / brackets (10-11),
	# the ghost bars and banner (14) above them; the countdown shows on its own.
	_overlay = HudOverlayFx.new()
	add_child(_overlay)
	_brackets = HudShieldBrackets.new()
	add_child(_brackets)
	_dash = HudDashBars.new()
	add_child(_dash)
	_crosshair = HudCrosshair.new()
	add_child(_crosshair)
	_top_bar = HudTopBar.new()
	add_child(_top_bar)
	_ghost = HudGhostIndicator.new()
	add_child(_ghost)
	_banner = HudStreakBanner.new()
	add_child(_banner)
	_countdown = HudCountdown.new()
	add_child(_countdown)
	_countdown.visible = false

func _process(delta: float) -> void:
	if _human == null or _match == null:
		return
	var player := _human.player
	var cd := _match.countdown_label()
	var live := cd == ""
	_countdown.visible = not live
	if not live:
		_countdown.set_number(cd)
		_countdown.tick(delta)
	for element in [_top_bar, _crosshair, _brackets, _dash]:
		element.visible = live
	_top_bar.set_state(_match.score_of(HUMAN_ID), _match.score_of(BOT_ID), HudModel.match_time(_match.seconds_left()))
	_top_bar.set_streaks(_match.streak_of(HUMAN_ID), _match.streak_of(BOT_ID))
	_crosshair.set_progress(player.beam_progress())
	_brackets.set_state(player.shield_progress(), player.is_shielded())
	_dash.set_progress(player.dash_progress())
	_overlay.set_ghost(live and player.respawning)
	_overlay.set_shield_active(live and player.is_shielded())
	_overlay.set_windup(player.windup_progress() if live else 0.0)
	if live and player.respawning:
		_ghost.show_progress(player.respawn_timer / MatchConst.RESPAWN_GHOST_MS)   # web progress runs 1 -> 0
	else:
		_ghost.hide_indicator()
	_banner.tick(delta)

## web BEAM_FLASH: only the local player's own shot tints the screen.
func _on_fired(shooter_id: int) -> void:
	if shooter_id == HUMAN_ID:
		_overlay.flash_beam()

## web SHIELD_BLOCK: the local player blocked a shot.
func _on_blocked(_shooter_id: int, victim_id: int, _perfect: bool) -> void:
	if victim_id == HUMAN_ID:
		_overlay.flash_block()

func _on_frag(shooter_id: int, victim_id: int, streak: int, first_blood: bool) -> void:
	if victim_id == HUMAN_ID:
		_overlay.flash_hit()   # web PLAYER_HIT: the local player was killed
	var kind := Streak.announce_kind(streak, first_blood)
	if kind != "":   # web announces every player's streak, in the shooter's colour
		_banner.announce(_match.roster.name_of(shooter_id), kind,
			_match.roster.color_of(shooter_id, AppearanceConst.FALLBACK_EFFECT_COLOR))
