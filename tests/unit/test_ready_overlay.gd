extends GutTest
## The ready ritual overlay against web ReadyOverlay (parity-capture-ready.mjs, 1280×720): the duel corners, the 2v2
## list around the middle line, the hint and its waiting state, the click, the legend's two centred rows, and the
## overlay only in the ready phase.

const SCREEN := Vector2i(1280, 720)
const PX := 2.0
const HUMAN := 0
const PROFILE := {"name": "PARITY7", "primaryColor": "#fa4", "reserveColor": "#4af"}

func _match(bots: Array, bots_ready := true) -> MatchNode:
	var match_node := MatchNode.new()
	autofree(match_node)
	match_node.roster.add(Roster.human_entry(HUMAN, PlayerProfile.sanitize(PROFILE, func() -> float: return 0.5)))
	match_node.phase.add_participant(HUMAN)
	for slot in bots:
		match_node.roster.add(Roster.bot_entry(slot, "B%d" % slot, RoomModel.PASSIVE_DIFFICULTY))
		match_node.phase.add_participant(slot, bots_ready)
	return match_node

func _overlay(match_node: MatchNode) -> ReadyOverlay:
	var viewport := SubViewport.new()
	viewport.size = SCREEN
	add_child_autofree(viewport)
	var overlay := ReadyOverlay.new()
	viewport.add_child(overlay)
	overlay.setup(match_node)
	return overlay

func _near(actual: float, expected: float, what: String) -> void:
	assert_true(absf(actual - expected) <= PX, "%s: %s vs web %s" % [what, actual, expected])

func test_duel_corners() -> void:
	var overlay := _overlay(_match([1]))
	assert_true(overlay.visible, "web matchPhase 'ready'")
	var mine := overlay.names()[HUMAN] as UnderlinedLabel
	assert_true(mine.underline, "the local name is underlined")
	assert_false((overlay.names()[1] as UnderlinedLabel).underline)
	assert_eq(mine.get_global_rect().position, Vector2(18.0, 18.0), ".ready-corner left / top 18px")
	assert_eq((overlay.statuses()[HUMAN] as Label).text, "○ NOT READY")
	assert_eq((overlay.statuses()[1] as Label).text, "READY ✓", "bots are ready from the start")
	_near((overlay.statuses()[HUMAN] as Label).get_global_rect().position.y, 37.0, "small at 37")
	_near((overlay.names()[1] as Label).get_global_rect().end.x, 1262.0, "the right corner ends 18px from the edge")

func test_the_list_for_more_players() -> void:
	var overlay := _overlay(_match([1, 2, 3]))
	var first := (overlay.names()[HUMAN] as Label).get_global_rect()
	_near(first.end.x, 634.0, "names end 6px left of the middle")
	_near(first.position.y, 64.0, "the list at top 64")
	_near((overlay.statuses()[HUMAN] as Label).get_global_rect().position.x, 646.0, "statuses start 6px right of it")
	_near((overlay.names()[1] as Label).get_global_rect().position.y - first.position.y, 24.0, "rows 18 + 6 apart")

func test_the_hint_the_click_and_the_waiting_state() -> void:
	var match_node := _match([1], false)
	var overlay := _overlay(match_node)
	var key := overlay.find_child("Key", true, false) as Control
	_near(key.get_global_rect().position.x, 568.87, "the key chip at 568.87")
	_near(key.get_global_rect().position.y, 348.5, "centred on the screen")
	watch_signals(overlay)
	var click := InputEventMouseButton.new()
	click.button_index = MOUSE_BUTTON_LEFT
	click.pressed = false
	overlay._on_input(click)
	assert_signal_emitted(overlay, "ready_requested", "web onClick anywhere")
	match_node.mark_ready(HUMAN)
	overlay.refresh()
	assert_true(overlay.visible, "the other seat has not confirmed yet")
	assert_false(key.visible)
	assert_true((overlay.find_child("Waiting", true, false) as Control).visible, "WAITING FOR OPPONENT")

func test_the_legend_wraps_into_two_centred_rows() -> void:
	var overlay := _overlay(_match([1]))
	var box := (overlay.find_child("Legend", true, false) as Control).get_global_rect()
	assert_eq(box, Rect2(320.0, 634.0, 640.0, 72.0), "web .ready-legend box")

func test_hidden_outside_the_ready_phase() -> void:
	var match_node := _match([1])
	var overlay := _overlay(match_node)
	match_node.mark_ready(HUMAN)
	overlay.refresh()
	assert_false(overlay.visible, "the countdown takes over")
