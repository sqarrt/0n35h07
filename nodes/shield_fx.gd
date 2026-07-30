class_name ShieldFx extends Node3D
## Dome shield visual (placeholder). Styled skins (dome/hex/crystal) are a later slice.

const DOME_RADIUS := 1.0

var _dome: MeshInstance3D

func _ready() -> void:
	_dome = MeshInstance3D.new()
	var sph := SphereMesh.new()
	sph.radius = DOME_RADIUS
	sph.height = DOME_RADIUS * 2.0
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.3, 0.7, 1.0, 0.25)
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.cull_mode = BaseMaterial3D.CULL_DISABLED
	_dome.mesh = sph
	_dome.material_override = mat
	_dome.visible = false
	add_child(_dome)

func show_dome(on: bool) -> void:
	_dome.visible = on

func is_dome_visible() -> bool:
	return _dome.visible
