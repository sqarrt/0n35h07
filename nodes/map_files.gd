class_name MapFiles
## Reads a map's JSON file (raw editor data or compiled geo) into a Dictionary.

static func read_json(path: String) -> Dictionary:
	return JSON.parse_string(FileAccess.get_file_as_string(path))
