extends GutTest
## The lobby's maps (MapCatalog, web MAP_IDS) all build, and the game starts on the catalog's first map by default.

const MIN_GEOMETRY_CHILDREN := 4          # the floor plus blocks

func test_the_default_map_is_the_first_lobby_map() -> void:
	assert_eq(Game.selected_map, MapCatalog.raw_path(MapCatalog.MAP_IDS[0]), "web handlePlay preselects MAP_IDS[0]")

func test_all_lobby_maps_build() -> void:
	for id in MapCatalog.MAP_IDS:
		var built := MapLoader.build(MapCatalog.raw_path(id))
		assert_gt(built.get_child_count(), MIN_GEOMETRY_CHILDREN, "%s builds geometry (floor + blocks)" % id)
		built.free()
