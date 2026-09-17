extends GutTest
## Map catalog: the lobby's maps, each with its raw map, compiled geometry and preview image. The list itself is
## kept by the map editor (map-editor/ writes it into sim/map_catalog.gd when a map is created, renamed or deleted),
## so the test checks that it and the files on disk agree — not a fixed set of names.

func test_every_lobby_map_has_its_files() -> void:
	assert_gt(MapCatalog.MAP_IDS.size(), 0, "the lobby needs at least one map")
	for id in MapCatalog.MAP_IDS:
		assert_true(FileAccess.file_exists(MapCatalog.raw_path(id)), "%s raw map" % id)
		assert_true(FileAccess.file_exists(MapCatalog.geo_path(id)), "%s geometry" % id)
		assert_true(ResourceLoader.exists(MapCatalog.preview_path(id)), "%s preview" % id)

func test_no_map_is_left_out_of_the_lobby() -> void:
	# A map the editor wrote but never registered would be invisible in the game — the editor keeps them in step.
	for file in DirAccess.get_files_at(MapCatalog.MAP_DIR):
		if not file.ends_with(MapCatalog.RAW_SUFFIX) or file.ends_with(MapCatalog.GEO_SUFFIX):
			continue
		var id := file.trim_suffix(MapCatalog.RAW_SUFFIX)
		assert_true(MapCatalog.MAP_IDS.has(id), "%s is on disk but not in MAP_IDS" % id)
