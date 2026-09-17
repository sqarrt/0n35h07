class_name MapCatalog
## The lobby's maps in the web order (game/maps.ts MAP_IDS), with their data files and preview images.

const MAP_IDS := ["os_arena", "os_india", "os_pillars", "os_pool_day", "os_sotia"]
const MAP_DIR := "res://maps/"
const PREVIEW_DIR := "res://assets/maps/previews/"
const RAW_SUFFIX := ".map"                      # the map's source (JSON text, imported as a JsonPack)
const GEO_SUFFIX := ".geo"                      # its compiled geometry (imported as a MapGeo)
const PREVIEW_SUFFIX := ".png"

## The map's source (its compiled geometry sits next to it as <id>.geo).
static func raw_path(id: String) -> String:
	return MAP_DIR + id + RAW_SUFFIX

static func geo_path(id: String) -> String:
	return MAP_DIR + id + GEO_SUFFIX

static func preview_path(id: String) -> String:
	return PREVIEW_DIR + id + PREVIEW_SUFFIX
