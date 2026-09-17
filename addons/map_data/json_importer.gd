@tool
extends EditorImportPlugin
## `maps/<id>.map` (a map's source) and `assets/demos/<id>.demo` (a recorded clip) → a compressed JsonPack. The text
## stays the repository's readable source; the build carries the packed copy.

const SAVE_EXTENSION := "res"

func _get_importer_name() -> String: return "oneshot.json_pack"
func _get_visible_name() -> String: return "JSON pack"
func _get_recognized_extensions() -> PackedStringArray: return PackedStringArray(["map", "demo"])
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
	var pack := JsonPack.of(FileAccess.get_file_as_string(source_file))
	if pack.data().is_empty():
		push_error("not a JSON document: %s" % source_file)
		return ERR_PARSE_ERROR
	return ResourceSaver.save(pack, "%s.%s" % [save_path, SAVE_EXTENSION], ResourceSaver.FLAG_COMPRESS)
