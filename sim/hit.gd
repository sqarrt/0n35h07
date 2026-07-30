class_name HitResult extends RefCounted
## A combat raycast hit. entity_id == -1 means world/none (e.g. a wall).

var entity_id := -1
var point := Vector3.ZERO
var normal := Vector3.UP

func _init(eid := -1, p := Vector3.ZERO, n := Vector3.UP) -> void:
	entity_id = eid
	point = p
	normal = n
