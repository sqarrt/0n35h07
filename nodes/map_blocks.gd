class_name MapBlocks
## Map block see-through — port of web World.setBlocksTransparent: while anyone is on a SINGULARITY streak every block
## mesh turns 20% opaque without writing depth (players stay visible behind cover); turning it off restores each
## block's own opacity, so glass blocks stay see-through.

const GROUP := "map_blocks"
const META_BASE_OPACITY := "base_opacity"
const GLASS_OPACITY := 0.2          # web BLOCK_TRANSPARENT_OPACITY
const SEE_THROUGH_OPACITY := 0.2    # web setBlocksTransparent(true)
const OPAQUE := 1.0

## Register a block mesh (its material_override must be a StandardMaterial3D) with its own opacity.
static func mark(block: MeshInstance3D, base_opacity: float) -> void:
	block.add_to_group(GROUP)
	block.set_meta(META_BASE_OPACITY, base_opacity)
	_apply(block, base_opacity)

static func set_transparent(tree: SceneTree, on: bool) -> void:
	for node in tree.get_nodes_in_group(GROUP):
		var block := node as MeshInstance3D
		_apply(block, SEE_THROUGH_OPACITY if on else float(block.get_meta(META_BASE_OPACITY, OPAQUE)))

## Alpha-blended materials skip the depth write in Godot (web depthWrite: false); opaque ones keep it.
static func _apply(block: MeshInstance3D, opacity: float) -> void:
	var material := block.material_override as StandardMaterial3D
	material.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA if opacity < OPAQUE else BaseMaterial3D.TRANSPARENCY_DISABLED
	material.albedo_color.a = opacity
