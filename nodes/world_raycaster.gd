class_name WorldRaycaster extends RefCounted
## Godot physics combat raycast over world + hitbox layers. Nearest hit wins;
## a collider exposing `entity_id` yields it, otherwise -1 (a wall). `pierce` ignores map blocks (SINGULARITY).

var _space: PhysicsDirectSpaceState3D

func _init(space: PhysicsDirectSpaceState3D) -> void:
	_space = space

func raycast(origin: Vector3, dir: Vector3, exclude_ids: Array, pierce := false):
	var to := origin + dir.normalized() * CombatConst.AIM_RANGE
	var params := PhysicsRayQueryParameters3D.create(origin, to)
	params.collision_mask = CombatConst.PIERCE_RAY_MASK if pierce else CombatConst.COMBAT_RAY_MASK
	params.collide_with_bodies = true
	params.collide_with_areas = false
	if not exclude_ids.is_empty():
		params.exclude = exclude_ids   # array of RIDs to skip (e.g. the shooter)
	var res := _space.intersect_ray(params)
	if res.is_empty():
		return null
	var collider = res["collider"]
	var eid := -1
	if collider != null and "entity_id" in collider:
		eid = collider.entity_id
	return HitResult.new(eid, res["position"], res["normal"])
