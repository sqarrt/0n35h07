class_name TargetDummy extends Node3D
## A cosmetic target: a hitbox you can shoot, with a hit flash + an optional shield.
## No health, never dies. The shield blocks beams (demonstrates the 2c block path).

const FLASH_TIME := 0.25
const BLOCK_TIME := 0.25
const AUTO_SHIELD_INTERVAL := 3.0

@export var entity_id := 0
@export var auto_shield := false

var _flash := 0.0
var _block := 0.0
var _shield := Shield.new()
var _shield_fx: ShieldFx
var _auto := 0.0
@onready var _hitbox: Hitbox = $Hitbox
@onready var _mesh: MeshInstance3D = $Mesh

func _ready() -> void:
	add_to_group("targets")
	_hitbox.entity_id = entity_id
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.7, 0.2, 0.2)
	_mesh.material_override = mat
	_shield_fx = ShieldFx.new()
	add_child(_shield_fx)
	_shield_fx.position = Vector3(0, 1, 0)

func on_hit() -> void:
	_flash = FLASH_TIME

func is_flashing() -> bool:
	return _flash > 0.0

func raise_shield() -> void:
	_shield.activate()

func is_shielded() -> bool:
	return _shield.is_active()

func on_block() -> void:
	_block = BLOCK_TIME

func is_blocking() -> bool:
	return _block > 0.0

func _process(delta: float) -> void:
	_shield.update(delta)
	_shield_fx.show_dome(_shield.is_active())
	if auto_shield:
		_auto += delta
		if _auto >= AUTO_SHIELD_INTERVAL:
			_auto = 0.0
			_shield.activate()
	if _flash > 0.0:
		_flash = maxf(0.0, _flash - delta)
		var t := _flash / FLASH_TIME
		(_mesh.material_override as StandardMaterial3D).albedo_color = Color(0.7, 0.2, 0.2).lerp(Color(1, 1, 1), t)
	elif _block > 0.0:
		_block = maxf(0.0, _block - delta)
		var t := _block / BLOCK_TIME
		(_mesh.material_override as StandardMaterial3D).albedo_color = Color(0.7, 0.2, 0.2).lerp(Color(0.3, 0.7, 1.0), t)
