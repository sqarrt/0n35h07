class_name SystemFontMetrics
## Chrome's line metrics of a system face on Windows (Skia over DirectWrite): the OS/2 typo ascender and descender when
## the face sets USE_TYPO_METRICS (Cambria Math), otherwise its winAscent and winDescent — not the hhea values FreeType
## hands Godot (Segoe UI Emoji: 1.079 / 0.251 em against 0.728 / 0.210, a 20 px line at 15.2 px where Godot makes 17).
## Read from the font file the OS resolves the family to; in a collection the face whose family name matches (Godot's
## SystemFont opens a collection's first face: Cambria for Cambria Math). {} / -1 where no file can be read.

const COLLECTION_TAG := "ttcf"
const TAG_BYTES := 4
const COLLECTION_COUNT_AT := 8
const DIRECTORY_COUNT_AT := 4
const DIRECTORY_HEADER := 12
const TABLE_RECORD := 16
const HEAD := "head"
const OS2 := "OS/2"
const NAME := "name"
const UNITS_PER_EM_AT := 18                    # head
const FS_SELECTION_AT := 62                    # OS/2
const TYPO_ASCENDER_AT := 68
const WIN_ASCENT_AT := 74
const USE_TYPO_METRICS := 128                  # fsSelection bit 7
const NAME_COUNT_AT := 2
const NAME_HEADER := 6
const NAME_RECORD := 12
const FAMILY_NAME_ID := 1
const WINDOWS_PLATFORM := 3
const ENGLISH_US := 0x409
const SIGN_BIT := 0x8000
const UINT16_RANGE := 0x10000
const ASCENT := "ascent"
const DESCENT := "descent"
const NO_FACE := -1

static var _cache := {}                        # family -> {ascent, descent} in em ({} when unreadable)

## The family's ascent and descent in em as Chrome lays a line with it, or {}.
static func line_em(family: String) -> Dictionary:
	if not _cache.has(family):
		_cache[family] = file_em(OS.get_system_font_path(family), family)
	return _cache[family]

## The family's face in the file the OS resolves it to: its index in a collection, 0 for a single face, -1 unreadable.
static func face_index(family: String) -> int:
	return file_face(OS.get_system_font_path(family), family)

## The metrics of the font file at `path` (in a collection: the face named `family`), or {}.
static func file_em(path: String, family := "") -> Dictionary:
	var file := _open(path)
	if file == null:
		return {}
	var offsets := _face_offsets(file)
	var index := _find(file, offsets, family)
	return {} if index == NO_FACE else _metrics(file, _tables(file, offsets[index]))

## The index of the face named `family` in the file at `path` (a single-face file: 0), or -1.
static func file_face(path: String, family := "") -> int:
	var file := _open(path)
	return NO_FACE if file == null else _find(file, _face_offsets(file), family)

static func _open(path: String) -> FileAccess:
	if path == "":
		return null
	var file := FileAccess.open(path, FileAccess.READ)
	if file != null:
		file.big_endian = true
	return file

static func _face_offsets(file: FileAccess) -> Array:
	file.seek(0)
	if file.get_buffer(TAG_BYTES).get_string_from_ascii() != COLLECTION_TAG:
		return [0]
	file.seek(COLLECTION_COUNT_AT)
	var count := file.get_32()
	var offsets := []
	for i in count:
		offsets.append(file.get_32())
	return offsets

## The first face with line metrics whose family matches (any face of a single-face file).
static func _find(file: FileAccess, offsets: Array, family: String) -> int:
	for i in offsets.size():
		var tables := _tables(file, offsets[i])
		if not (tables.has(HEAD) and tables.has(OS2)):
			continue
		if offsets.size() > 1 and family != "" and tables.has(NAME) and _family(file, tables[NAME]) != family:
			continue
		return i
	return NO_FACE

static func _tables(file: FileAccess, face: int) -> Dictionary:
	file.seek(face + DIRECTORY_COUNT_AT)
	var count := file.get_16()
	var tables := {}
	for i in count:
		file.seek(face + DIRECTORY_HEADER + TABLE_RECORD * i)
		var tag := file.get_buffer(TAG_BYTES).get_string_from_ascii()
		file.get_32()                                   # checksum
		tables[tag] = file.get_32()
	return tables

static func _metrics(file: FileAccess, tables: Dictionary) -> Dictionary:
	file.seek(tables[HEAD] + UNITS_PER_EM_AT)
	var units := float(file.get_16())
	file.seek(tables[OS2] + FS_SELECTION_AT)
	var selection := file.get_16()
	file.seek(tables[OS2] + TYPO_ASCENDER_AT)
	var typo_ascender := _signed(file.get_16())
	var typo_descender := _signed(file.get_16())
	file.seek(tables[OS2] + WIN_ASCENT_AT)
	var win_ascent := file.get_16()
	var win_descent := file.get_16()
	if selection & USE_TYPO_METRICS:
		return {ASCENT: typo_ascender / units, DESCENT: -typo_descender / units}
	return {ASCENT: win_ascent / units, DESCENT: win_descent / units}

## The face's English family name (name ID 1, Windows platform).
static func _family(file: FileAccess, table: int) -> String:
	file.seek(table + NAME_COUNT_AT)
	var count := file.get_16()
	var strings := file.get_16()
	for i in count:
		file.seek(table + NAME_HEADER + NAME_RECORD * i)
		var platform := file.get_16()
		file.get_16()                                   # encoding
		var language := file.get_16()
		var name_id := file.get_16()
		var length := file.get_16()
		var offset := file.get_16()
		if name_id == FAMILY_NAME_ID and platform == WINDOWS_PLATFORM and language == ENGLISH_US:
			file.seek(table + strings + offset)
			var big := file.get_buffer(length)
			var little := PackedByteArray()
			little.resize(length)
			for byte in range(0, length - 1, 2):      # UTF-16BE to the little-endian get_string_from_utf16 reads
				little[byte] = big[byte + 1]
				little[byte + 1] = big[byte]
			return little.get_string_from_utf16()
	return ""

static func _signed(value: int) -> int:
	return value - UINT16_RANGE if value & SIGN_BIT else value
