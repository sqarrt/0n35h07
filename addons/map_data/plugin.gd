@tool
extends EditorPlugin
## Turns the editor's map artifacts into the resources the game loads: `maps/<id>.geo` (compiled geometry) and the
## JSON packs `maps/<id>.map` / `assets/demos/<id>.demo`. The sources stay in the repository for the map editor and
## for diffs; only the imported resources are exported, and they are stored compressed — the geometry of one map is
## 30 MB of base64 JSON and about 1 MB as a resource, and the game no longer parses any of it at load.

const GeoImporter := preload("res://addons/map_data/geo_importer.gd")
const JsonImporter := preload("res://addons/map_data/json_importer.gd")

var _importers: Array[EditorImportPlugin] = []

func _enter_tree() -> void:
	_importers = [GeoImporter.new(), JsonImporter.new()]
	for importer in _importers:
		add_import_plugin(importer)

func _exit_tree() -> void:
	for importer in _importers:
		remove_import_plugin(importer)
	_importers.clear()
