extends GutTest
## Streak effects wired into the HUD like web MatchHud / StreakBanner: names take the streak tier (EffectText), dots
## count the streak in the player colour, and every frag announces its kind in the shooter's colour.

const PLAYER := preload("res://scenes/player.tscn")
const SCREEN := Vector2i(1280, 720)
const HUMAN_ID := 0
const OTHER_ID := 1
const EPS := 0.001
const RUN_S := 0.5

func _top_bar() -> HudTopBar:
	var screen := SubViewport.new()
	screen.size = SCREEN
	add_child_autofree(screen)
	var bar := HudTopBar.new()
	screen.add_child(bar)
	return bar

func test_names_take_the_streak_tier_and_dots_count_it() -> void:
	var bar := _top_bar()
	var you := bar.find_child("YouName", true, false) as EffectText
	var dots := bar.find_child("YouDots", true, false) as Label
	assert_eq(you.kind(), "", "no streak: the plain .nm name")
	assert_eq(you.shown_text(), HudTopBar.YOU_LABEL)
	assert_false(dots.visible)
	bar.set_streaks(Streak.STREAK_TRIPLE, 0)
	assert_eq(you.kind(), "triple")
	assert_eq(dots.text, "●●●")
	assert_true(dots.visible)
	assert_eq(dots.get_theme_color("font_color"), HudTopBar.YOU_COLOR, "dots inherit the player colour")
	assert_eq((bar.find_child("OpponentName", true, false) as EffectText).kind(), "")

func test_the_same_tier_keeps_its_animation_running() -> void:
	var bar := _top_bar()
	var you := bar.find_child("YouName", true, false) as EffectText
	bar.set_streaks(Streak.STREAK_TRIPLE, 0)
	you.advance(RUN_S)
	bar.set_streaks(Streak.STREAK_TRIPLE + 1, 0)
	assert_almost_eq(you.elapsed(), RUN_S, EPS, "web: same kind/text props -> no remount")
	assert_eq((bar.find_child("YouDots", true, false) as Label).text.length(), Streak.STREAK_TRIPLE + 1)

func test_hud_follows_player_streaks_and_announces_frags() -> void:
	var screen := SubViewport.new()
	screen.size = SCREEN
	add_child_autofree(screen)
	var human: PlayerNode = PLAYER.instantiate()
	human.get_node("Camera3D").free()
	screen.add_child(human)
	var match_node := MatchNode.new()
	screen.add_child(match_node)
	match_node.add_entity(human, 0)
	var hud := Hud.new()
	screen.add_child(hud)
	hud.setup(human, match_node)
	match_node.force_live()
	human.player.streak = Streak.STREAK_DOUBLE
	hud._process(0.0)
	assert_eq((hud.find_child("YouName", true, false) as EffectText).kind(), "double")
	match_node.frag.emit(OTHER_ID, HUMAN_ID, Streak.STREAK_DOUBLE, false)
	var banner := (hud.find_child("StreakBanner", true, false) as HudStreakBanner).text()
	assert_eq(banner.kind(), "double")
	assert_eq(banner.shown_text(), "BOT: DOUBLE KILL")
	assert_eq(banner.glow().label().get_theme_color("font_color"), HudModel.OPPONENT_COLOR, "shooter's colour")
