extends GutTest
## Streak effects and roster identity wired into the HUD like web MatchHud / StreakBanner: names come from the roster
## and take the streak tier (EffectText), frags and dots take the player colour, and every frag announces its kind with
## the shooter's name and colour.

const PLAYER := preload("res://scenes/player.tscn")
const SCREEN := Vector2i(1280, 720)
const HUMAN_ID := 0
const OTHER_ID := 1
const EPS := 0.001
const RUN_S := 0.5
const YOU := {"id": 0, "name": "RA-1", "color": "#4af"}
const BOT := {"id": 1, "name": "EX82R", "color": "#fd4"}

func _top_bar() -> HudTopBar:
	var screen := SubViewport.new()
	screen.size = SCREEN
	add_child_autofree(screen)
	var bar := HudTopBar.new()
	screen.add_child(bar)
	return bar

func test_without_a_roster_the_web_fallbacks_show() -> void:
	var bar := _top_bar()
	assert_eq((bar.find_child("YouName", true, false) as EffectText).base_text(), HudTopBar.YOU_LABEL)
	assert_eq((bar.find_child("OpponentName", true, false) as EffectText).base_text(), HudTopBar.OPPONENT_LABEL)
	assert_eq((bar.find_child("YouFrags", true, false) as Label).get_theme_color("font_color"),
		Color(AppearanceConst.FALLBACK_TEXT_COLOR), "no entry: the frags inherit --text")

func test_names_and_colours_come_from_the_roster() -> void:
	var bar := _top_bar()
	bar.set_players(YOU, BOT)
	assert_eq((bar.find_child("YouName", true, false) as EffectText).base_text(), "RA-1")
	assert_eq((bar.find_child("OpponentName", true, false) as EffectText).base_text(), "EX82R")
	assert_eq((bar.find_child("YouFrags", true, false) as Label).get_theme_color("font_color"), Color("#4af"))
	assert_eq((bar.find_child("OpponentFrags", true, false) as Label).get_theme_color("font_color"), Color("#fd4"))

func test_names_take_the_streak_tier_and_dots_count_it() -> void:
	var bar := _top_bar()
	bar.set_players(YOU, BOT)
	var you := bar.find_child("YouName", true, false) as EffectText
	var dots := bar.find_child("YouDots", true, false) as Label
	assert_eq(you.kind(), "", "no streak: the plain .nm name")
	assert_false(dots.visible)
	bar.set_streaks(Streak.STREAK_TRIPLE, 0)
	assert_eq(you.kind(), "triple")
	assert_eq(dots.text, "●●●")
	assert_true(dots.visible)
	assert_eq(dots.get_theme_color("font_color"), Color("#4af"), "dots inherit the player colour")
	assert_eq((bar.find_child("OpponentName", true, false) as EffectText).kind(), "")

func test_the_same_tier_keeps_its_animation_running() -> void:
	var bar := _top_bar()
	bar.set_players(YOU, BOT)
	var you := bar.find_child("YouName", true, false) as EffectText
	bar.set_streaks(Streak.STREAK_TRIPLE, 0)
	you.advance(RUN_S)
	bar.set_streaks(Streak.STREAK_TRIPLE + 1, 0)
	assert_almost_eq(you.elapsed(), RUN_S, EPS, "web: same kind/text props -> no remount")
	assert_eq((bar.find_child("YouDots", true, false) as Label).text.length(), Streak.STREAK_TRIPLE + 1)

func test_hud_follows_the_roster_and_player_streaks() -> void:
	var screen := SubViewport.new()
	screen.size = SCREEN
	add_child_autofree(screen)
	var human: PlayerNode = PLAYER.instantiate()
	human.get_node("Camera3D").free()
	screen.add_child(human)
	var match_node := MatchNode.new()
	match_node.roster.add(YOU)
	match_node.roster.add(BOT)
	screen.add_child(match_node)
	match_node.add_entity(human, 0)
	var hud := Hud.new()
	screen.add_child(hud)
	hud.setup(human, match_node, preload("res://tests/support/locked_pointer.gd").new())
	match_node.force_live()
	human.player.streak = Streak.STREAK_DOUBLE
	hud._process(0.0)
	var you := hud.find_child("YouName", true, false) as EffectText
	assert_eq(you.base_text(), "RA-1")
	assert_eq(you.kind(), "double")
	match_node.frag.emit(OTHER_ID, HUMAN_ID, Streak.STREAK_DOUBLE, false)
	var banner := (hud.find_child("StreakBanner", true, false) as HudStreakBanner).text()
	assert_eq(banner.kind(), "double")
	assert_eq(banner.shown_text(), "EX82R: DOUBLE KILL")
	assert_eq(banner.glow().label().get_theme_color("font_color"), Color("#fd4"), "shooter's colour")
