extends GutTest
## The cut's nodes (theme.css .trailer-cut) and the finale title card (.trailer-title-wrap).

const SCREEN := Vector2(1280.0, 720.0)
const TEXT := "READ YOUR OPPONENT"
const SLAM_S := 0.117                          # 13% of the 900 ms cut
const HOLD_S := 0.45
const EPS := 0.5
const HALF := 0.5

func _view() -> TrailerCutView:
	var holder := Control.new()
	holder.size = SCREEN
	add_child_autofree(holder)
	var view := TrailerCutView.new()
	holder.add_child(view)   # anchored to the full holder
	view.start(TEXT, TrailerEdl.CUT_MS)
	return view

func test_the_letters_close_up_as_the_text_slams_in() -> void:
	var view := _view()
	var wide := view.text().get_combined_minimum_size().x
	view.advance(SLAM_S)
	var slam := view.text().get_combined_minimum_size().x
	assert_lt(slam, wide, "letter-spacing 0.5em -> 0.2em")
	assert_eq(view.text().layer_count(), TrailerCut.shadows(0.0).size())

func test_the_text_is_centred_once_it_holds() -> void:
	var view := _view()
	view.advance(HOLD_S)
	var box := view.text().get_combined_minimum_size()
	var origin := view.text_transform().origin
	assert_almost_eq(origin.x, (SCREEN.x - box.x) * HALF, EPS)
	assert_almost_eq(origin.y, (SCREEN.y - box.y) * HALF, EPS)
	assert_eq(view.fade().opacity(), 1.0)

func test_the_bar_sweeps_open_across_the_middle() -> void:
	var view := _view()
	assert_false(view.bar().visible, "scaleX(0)")
	view.advance(TrailerCut.BAR_S)
	var bar := view.bar()
	var pad := (bar.material as ShaderMaterial).get_shader_parameter("pad_px") as Vector2
	assert_almost_eq(bar.size.x - pad.x * 2.0, SCREEN.x, EPS, "the full width")
	assert_almost_eq(bar.position.y + pad.y + TrailerCut.BAR_HEIGHT * HALF, SCREEN.y * HALF, EPS)
	assert_eq(bar.modulate.a, 0.0, "faded out")

func test_the_title_card_surfaces_line_by_line() -> void:
	var holder := Control.new()
	holder.size = SCREEN
	add_child_autofree(holder)
	var card := TrailerTitleCard.new()
	holder.add_child(card)   # anchored to the full holder
	card.show_card()
	card.advance(TrailerTitleCard.DELAYS_S[1])
	var items := card.items()
	assert_gt(items[0].opacity(), 0.0)
	assert_eq(items[1].opacity(), 0.0, "the tagline waits 0.35 s")
	card.advance(TrailerTitleCard.DELAYS_S[2] + TrailerTitleCard.FADE_S)
	for item in items:
		assert_eq(item.opacity(), 1.0)
		assert_almost_eq(item.position.x + item.size.x * HALF, SCREEN.x * HALF, EPS, "centred")
	assert_lt(items[0].position.y, items[1].position.y)
	assert_lt(items[1].position.y, items[2].position.y)
