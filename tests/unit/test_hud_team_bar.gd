extends GutTest
## Multi-player top bar parity with web MatchHud: the panes around the timer, mirrored rows, the underlined own name,
## Battle team totals in the team colour, frags and streak dots following the scores.

const SCREEN := Vector2i(1280, 720)

func _entry(id: int, color: String) -> Dictionary:
	return {"id": id, "name": "P%d" % id, "color": color}

func _score(id: int, team: int, kills: int) -> Dictionary:
	return {"id": id, "team": team, "kills": kills, "deaths": 0}

func _bar() -> HudTeamBar:
	var viewport := SubViewport.new()
	viewport.size = SCREEN
	add_child_autofree(viewport)
	var bar := HudTeamBar.new()
	viewport.add_child(bar)
	return bar

func test_battle_panes_and_team_totals() -> void:
	var bar := _bar()
	var roster := [_entry(0, "#ffaa44"), _entry(1, "#44ffaa"), _entry(2, "#ff6666"), _entry(3, "#ffdd44")]
	var scores := [_score(0, 0, 1), _score(1, 0, 2), _score(2, 1, 0), _score(3, 1, 4)]
	bar.set_roster(roster, scores, 0)
	bar.set_state(scores, "02:59", {3: 2})
	var left := bar.find_child("TeamLeft", true, false)
	var right := bar.find_child("TeamRight", true, false)
	assert_eq(left.get_child(0).name, &"Row0", "my team on the left")
	assert_eq(left.get_child(left.get_child_count() - 1).name, &"TotalLeft", "the total next to the timer")
	assert_eq(right.get_child(0).name, &"TotalRight")
	assert_eq((bar.find_child("TotalLeft", true, false) as GlowText).label().text, "3")
	assert_eq((bar.find_child("TotalRight", true, false) as GlowText).label().text, "4")
	assert_eq((bar.find_child("TotalRight", true, false) as GlowText).label().get_theme_color("font_color"),
		GameModes.TEAM_COLORS[1], "in the team colour")
	assert_eq((bar.find_child("Timer", true, false) as Label).text, "02:59")

func test_rows_mirror_and_underline_the_local_player() -> void:
	var bar := _bar()
	var roster := [_entry(0, "#ffaa44"), _entry(1, "#44ffaa"), _entry(2, "#ff6666"), _entry(3, "#ffdd44")]
	var scores := [_score(0, 0, 0), _score(1, 1, 5), _score(2, 2, 0), _score(3, 3, 0)]
	bar.set_roster(roster, scores, 0)
	bar.set_state(scores, "03:00", {1: 2})
	var mine := bar.rows()[0] as HudTeamBar.Row
	assert_true(mine.underline)
	assert_eq(mine.get_child(0), mine.dots, "left pane: dots, name, frags")
	var theirs := bar.rows()[2] as HudTeamBar.Row
	assert_false(theirs.underline)
	assert_eq(theirs.get_child(0), theirs.frag, "right pane mirrored: frags first")
	assert_null(bar.find_child("TotalLeft", true, false), "War has no team totals")
	assert_eq((bar.rows()[1] as HudTeamBar.Row).frag.text, "5")
	assert_true((bar.rows()[1] as HudTeamBar.Row).dots.visible, "a streak shows its dots")
