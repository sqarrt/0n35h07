class_name JsonPack extends Resource
## A JSON document the game reads as data (a map's source, a recorded clip), packed at import time: the text is stored
## compressed, because these files are megabytes of repeating numbers. `data()` parses it once and keeps the result.

@export var compressed := PackedByteArray()
@export var size := 0                      # the text's length in bytes, which decompression needs up front

var _data := {}
var _parsed := false

static func of(text: String) -> JsonPack:
	var pack := JsonPack.new()
	var bytes := text.to_utf8_buffer()
	pack.size = bytes.size()
	pack.compressed = bytes.compress(FileAccess.COMPRESSION_ZSTD)
	return pack

## The document; parsed on the first call (an empty dictionary if the pack is empty or broken).
func data() -> Dictionary:
	if _parsed:
		return _data
	_parsed = true
	if size > 0:
		var text := compressed.decompress(size, FileAccess.COMPRESSION_ZSTD).get_string_from_utf8()
		var parsed = JSON.parse_string(text)
		if parsed is Dictionary:
			_data = parsed
	return _data
