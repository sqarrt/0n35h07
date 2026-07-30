class_name TargetDummy extends Node3D
## A cosmetic target: a hitbox you can shoot, with a hit flash. No health, never dies.

const FLASH_TIME := 0.25

@export var entity_id := 0

var _flash := 0.0
@onready var _hitbox: Hitbox = $Hitbox
@onready var _mesh: MeshInstance3D = $Mesh

func _ready() -> void:
	add_to_group("targets")
	_hitbox.entity_id = entity_id
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.7, 0.2, 0.2)
	_mesh.material_override = mat

func on_hit() -> void:
	_flash = FLASH_TIME

func is_flashing() -> bool:
	return _flash > 0.0

func _process(delta: float) -> void:
	if _flash > 0.0:
		_flash = maxf(0.0, _flash - delta)
		var t := _flash / FLASH_TIME
		(_mesh.material_override as StandardMaterial3D).albedo_color = Color(0.7, 0.2, 0.2).lerp(Color(1, 1, 1), t)
