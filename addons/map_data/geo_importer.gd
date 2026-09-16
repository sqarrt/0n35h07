@tool
extends EditorImportPlugin
## `maps/<id>.geo` (the map editor's compiled geometry) → a compressed MapGeo resource. The source JSON stays in the
## repository for the editor; only this resource is exported, and the game loads it without parsing anything.

const SAVE_EXTENSION := "res"

func _get_importer_name() -> String: return "oneshot.map_geo"
func _get_visible_name() -> String: return "Map geometry"
func _get_recognized_extensions() -> PackedStringArray: return PackedStringArray(["geo"])
func _get_save_extension() -> String: return SAVE_EXTENSION
func _get_resource_type() -> String: return "Resource"
func _get_priority() -> float: return 1.0
func _get_import_order() -> int: return ResourceImporter.IMPORT_ORDER_DEFAULT
func _get_preset_count() -> int: return 0
func _get_preset_name(_index: int) -> String: return ""
func _get_import_options(_path: String, _index: int) -> Array[Dictionary]: return []
func _get_option_visibility(_path: String, _option: StringName, _options: Dictionary) -> bool: return true

func _import(source_file: String, save_path: String, _options: Dictionary, _platform_variants: Array,
		_gen_files: Array) -> Error:
	var parsed = JSON.parse_string(FileAccess.get_file_as_string(source_file))
	if not (parsed is Dictionary):
		push_error("map geometry is not JSON: %s" % source_file)
		return ERR_PARSE_ERROR
	var geo := MapGeoBuild.from_json(parsed)
	return ResourceSaver.save(geo, "%s.%s" % [save_path, SAVE_EXTENSION], ResourceSaver.FLAG_COMPRESS)
