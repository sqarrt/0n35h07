class_name MapFiles
## Reads a map's source (`maps/<id>.map`) — the editor's JSON, imported into a compressed JsonPack, so the build
## carries neither the text nor the parse. Tools that work on the source text read it themselves.

static func read_map(path: String) -> Dictionary:
	var pack := load(path) as JsonPack
	return pack.data() if pack != null else {}
