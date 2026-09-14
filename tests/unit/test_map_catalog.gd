extends GutTest
## Map catalog: the five web lobby maps in order, each with its raw map, compiled geometry and preview image.

func test_every_lobby_map_has_its_files() -> void:
	assert_eq(MapCatalog.MAP_IDS, ["os_arena", "os_india", "os_pillars", "os_pool_day", "os_test"])
	for id in MapCatalog.MAP_IDS:
		assert_true(FileAccess.file_exists(MapCatalog.raw_path(id)), "%s raw map" % id)
		assert_true(FileAccess.file_exists(MapCatalog.geo_path(id)), "%s geometry" % id)
		assert_true(ResourceLoader.exists(MapCatalog.preview_path(id)), "%s preview" % id)
