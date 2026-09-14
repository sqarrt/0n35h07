class_name MapCatalog
## The lobby's maps in the web order (game/maps.ts MAP_IDS), with their data files and preview images.

const MAP_IDS := ["os_arena", "os_india", "os_pillars", "os_pool_day", "os_test"]
const MAP_DIR := "res://maps/"
const PREVIEW_DIR := "res://assets/maps/previews/"
const RAW_SUFFIX := ".json"
const GEO_SUFFIX := "_geo.json"
const PREVIEW_SUFFIX := ".png"

## The raw map (the geometry sits next to it as <id>_geo.json).
static func raw_path(id: String) -> String:
	return MAP_DIR + id + RAW_SUFFIX

static func geo_path(id: String) -> String:
	return MAP_DIR + id + GEO_SUFFIX

static func preview_path(id: String) -> String:
	return PREVIEW_DIR + id + PREVIEW_SUFFIX
