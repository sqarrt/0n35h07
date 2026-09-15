class_name RadioExplorerMenu
## The Radio library's context menu items — web RadioExplorer `menu(c)`: Play on an item, New folder always, Rename for
## an item with at most one selected, Copy when tracks are selected, Paste (disabled with nothing copied) and Delete
## when anything is selected. Each item carries its glyph, the system faces Chrome draws that glyph from (the capture's
## platform fonts), its shortcut and its looks.

const ACTION := "action"
const GLYPH := "glyph"
const LABEL_KEY := "label"
const ACCEL := "accel"
const DANGER := "danger"
const DISABLED := "disabled"
const FAMILIES := "families"

const PLAY := "play"
const NEW_FOLDER := "new_folder"
const RENAME := "rename"
const COPY := "copy"
const PASTE := "paste"
const DELETE := "delete"

const SYMBOL_FAMILIES := ["Segoe UI Symbol"]
const SPECS := {
	PLAY: {GLYPH: "▶", LABEL_KEY: "radioCtxPlay", ACCEL: "", FAMILIES: SYMBOL_FAMILIES},
	NEW_FOLDER: {GLYPH: "＋", LABEL_KEY: "radioCtxNewFolder", ACCEL: "", FAMILIES: ["Microsoft YaHei"]},
	RENAME: {GLYPH: "✎", LABEL_KEY: "radioCtxRename", ACCEL: "F2", FAMILIES: SYMBOL_FAMILIES},
	COPY: {GLYPH: "⧉", LABEL_KEY: "radioCtxCopy", ACCEL: "Ctrl+C", FAMILIES: ["Cambria Math"]},
	PASTE: {GLYPH: "📋", LABEL_KEY: "radioCtxPaste", ACCEL: "Ctrl+V", FAMILIES: ["Segoe UI Emoji"]},
	DELETE: {GLYPH: "🗑", LABEL_KEY: "radioCtxDelete", ACCEL: "Del", FAMILIES: SYMBOL_FAMILIES},
}
const MAX_RENAME_SELECTION := 1

## The items for a menu opened on an item (`on_entry`) or on the window, given the selection, how many of the selected
## are tracks, and how many tracks are copied.
static func items(on_entry: bool, selection_size: int, selected_tracks: int, clip_size: int) -> Array[Dictionary]:
	var out: Array[Dictionary] = []
	if on_entry:
		out.append(_item(PLAY))
	out.append(_item(NEW_FOLDER))
	if on_entry and selection_size <= MAX_RENAME_SELECTION:
		out.append(_item(RENAME))
	if selected_tracks > 0:
		out.append(_item(COPY))
	out.append(_item(PASTE, false, clip_size == 0))
	if selection_size > 0:
		out.append(_item(DELETE, true))
	return out

static func _item(action: String, danger := false, disabled := false) -> Dictionary:
	var item: Dictionary = SPECS[action].duplicate()
	item[ACTION] = action
	item[DANGER] = danger
	item[DISABLED] = disabled
	return item
