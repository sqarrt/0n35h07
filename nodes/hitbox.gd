class_name Hitbox extends StaticBody3D
## Combat raycast target (separate from any movement collider). Carries an entity id.

@export var entity_id := -1

func _ready() -> void:
	collision_layer = CombatConst.LAYER_HITBOX_BIT
	collision_mask = 0   # a target, not a detector
