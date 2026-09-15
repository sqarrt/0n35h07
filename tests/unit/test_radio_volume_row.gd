extends GutTest
## RadioVolumeRow — web RadioPlayer volRow (window capture: the row 266×20, the input 235 px from x 31): the pictogram,
## the 8 px gap, the range filling the rest and centred on the row; a drag reports the volume.

const EPS := 0.01
const WIDTH := 266.0

func _row() -> RadioVolumeRow:
	var row := RadioVolumeRow.new()
	add_child_autofree(row)
	row.size = Vector2(WIDTH, row.row_height())
	return row

func test_the_range_fills_the_row_after_the_pictogram() -> void:
	var row := _row()
	var left := CssPixel.snap(row.icon().css_size().x + RadioVolumeRow.GAP)
	assert_eq(row.range_input().position.x, left)
	assert_almost_eq(row.range_input().size.x, WIDTH - left, EPS)
	var track := row.range_input().track_rect()
	assert_almost_eq(row.range_input().position.y + track.get_center().y, row.size.y * 0.5, 0.5, "centred on the row")

func test_the_volume_shows_and_a_drag_reports_it() -> void:
	var row := _row()
	row.set_volume(0.8)
	assert_eq(row.range_input().value, 0.8)
	watch_signals(row)
	row.range_input().value_changed.emit(0.25)
	assert_signal_emitted_with_parameters(row, "volume_changed", [0.25])
