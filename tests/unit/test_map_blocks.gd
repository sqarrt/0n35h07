extends GutTest
## Block see-through parity with web World.setBlocksTransparent: every block turns 20% opaque in SINGULARITY mode and
## returns to its own opacity afterwards (glass blocks stay see-through).

const EPS := 0.001

func _block(base_opacity: float) -> MeshInstance3D:
	var block := MeshInstance3D.new()
	block.material_override = StandardMaterial3D.new()
	add_child_autofree(block)
	MapBlocks.mark(block, base_opacity)
	return block

func _material(block: MeshInstance3D) -> StandardMaterial3D:
	return block.material_override as StandardMaterial3D

func test_singularity_makes_blocks_see_through_and_restores_glass() -> void:
	var wall := _block(MapBlocks.OPAQUE)
	var glass := _block(MapBlocks.GLASS_OPACITY)
	assert_eq(_material(wall).transparency, BaseMaterial3D.TRANSPARENCY_DISABLED, "walls stay opaque and write depth")
	assert_eq(_material(glass).transparency, BaseMaterial3D.TRANSPARENCY_ALPHA)
	MapBlocks.set_transparent(get_tree(), true)
	for block in [wall, glass]:
		assert_eq(_material(block).transparency, BaseMaterial3D.TRANSPARENCY_ALPHA)
		assert_almost_eq(_material(block).albedo_color.a, MapBlocks.SEE_THROUGH_OPACITY, EPS)
	MapBlocks.set_transparent(get_tree(), false)
	assert_eq(_material(wall).transparency, BaseMaterial3D.TRANSPARENCY_DISABLED)
	assert_almost_eq(_material(wall).albedo_color.a, MapBlocks.OPAQUE, EPS)
	assert_almost_eq(_material(glass).albedo_color.a, MapBlocks.GLASS_OPACITY, EPS, "glass keeps its own opacity")
