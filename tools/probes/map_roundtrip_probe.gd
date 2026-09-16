extends SceneTree
## Probe: a map written by the map-editor package loads in the game — GeoLoader builds it, the spawns parse.
##   scripts/godot.sh --headless --path . -s tools/probes/map_roundtrip_probe.gd -- <map id>

const DEFAULT_ID := "os_roundtrip"

func _initialize() -> void:
	var args := OS.get_cmdline_user_args()
	var id: String = args[0] if args.size() > 0 else DEFAULT_ID
	var raw := MapFiles.read_map(MapCatalog.raw_path(id))
	var node := GeoLoader.build(MapCatalog.raw_path(id), MapCatalog.geo_path(id))
	root.add_child(node)
	var meshes := node.find_children("*", "MeshInstance3D", true, false).size()
	var bodies := node.find_children("*", "StaticBody3D", true, false).size()
	print("PROBE map=%s blocks=%d meshes=%d bodies=%d spawns=%s" % [id, raw["blocks"].size(), meshes, bodies,
		Spawns.from_raw(raw)])
	quit()
