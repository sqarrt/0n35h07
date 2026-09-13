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
var _overheat: HudOverheatVignette
var _ghost: HudGhostIndicator
var _audio_bar: HudAudioBar
var _stats: HudStatsOverlay
var _speed := 0.0                    # web SET_PLAYER_SPEED, throttled with the rest of the HUD
var _banner: HudStreakBanner
var _countdown: HudCountdown
var _throttle := HudThrottle.new()   # web syncHud: progress values at most every 50 ms
var _beam_progress := HudModel.READY
var _shield_progress := HudModel.READY
var _dash_progress := HudModel.READY
var _windup_progress := 0.0
var _respawn_progress = null         # null while not in the ghost phase
var _was_winding_up := false

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
	_stats = HudStatsOverlay.new()   # web z-index 12: over the top bar, under the overheat vignette
	add_child(_stats)
	_overheat = HudOverheatVignette.new()   # web z-index 13 (bolts 14): over the top bar, under the ghost bars / banner
	add_child(_overheat)
	_ghost = HudGhostIndicator.new()
	add_child(_ghost)
	_audio_bar = HudAudioBar.new()   # web z-index 14 after the respawn overlay, before the streak banner
	add_child(_audio_bar)
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
	_sync_progress(player, delta)
	_crosshair.set_progress(_beam_progress)
	_brackets.set_state(_shield_progress, player.is_shielded())   # shield visibility is immediate in the web
	_dash.set_progress(_dash_progress)
	_overlay.set_ghost(live and player.respawning)
	_overlay.set_shield_active(live and player.is_shielded())
	_overlay.set_windup(_windup_progress if live else 0.0)   # the overlay advances its own fade and flashes
	_overheat.set_tier(Streak.streak_tier(_match.streak_of(HUMAN_ID)) if live else "")   # web hud.streaks[localId]
	_overheat.tick(delta)
	var show_fps := bool(Game.profile.get("showFps", false))
	var show_speed := bool(Game.profile.get("showSpeed", false))
	_stats.visible = live and (show_fps or show_speed)   # web: StatsOverlay renders nothing without a flag
	_stats.set_flags(show_fps, show_speed)
	if _stats.visible:
		_stats.tick(delta * MatchNode.MS_PER_S)
		_stats.set_speed(_speed)
	var audio_bar_shown := live and bool(Game.profile.get("audioViz", true))   # web {audioViz && <AudioBar />}
	if audio_bar_shown and not _audio_bar.visible:
		_audio_bar.reset()   # web remounts the component with zeroed levels
	_audio_bar.visible = audio_bar_shown
	if audio_bar_shown:
		_audio_bar.tick(Audio.bands())
	if live and _respawn_progress != null:
		_ghost.show_progress(_respawn_progress)
		_ghost.tick(delta)
	else:
		_ghost.hide_indicator()
	_banner.tick(delta)

## web Match.syncHud: the windup ends at once, everything else is sampled at most every 50 ms.
func _sync_progress(player: Player, delta: float) -> void:
	var winding := player.is_winding_up()
	if not winding and _was_winding_up:
		_windup_progress = 0.0
	_was_winding_up = winding
	if not _throttle.tick(delta * MatchNode.MS_PER_S):
		return
	if winding:
		_windup_progress = player.windup_progress()
	_beam_progress = player.beam_progress()
	_shield_progress = player.shield_progress()
	_dash_progress = player.dash_progress()
	_speed = player.speed()
	_respawn_progress = player.respawn_timer / MatchConst.RESPAWN_GHOST_MS if player.respawning else null   # 1 -> 0

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
