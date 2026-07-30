extends GutTest

func test_game_offers_maps_with_a_default() -> void:
	assert_gt(Game.MAPS.size(), 1, "several maps offered")
	assert_true(Game.selected_map.begins_with("res://maps/"), "a default map is selected")

func test_all_listed_maps_build() -> void:
	for entry in Game.MAPS:
		var m := MapLoader.build(entry[1])
		assert_gt(m.get_child_count(), 4, "%s builds geometry (floor + blocks)" % entry[0])
		m.free()
