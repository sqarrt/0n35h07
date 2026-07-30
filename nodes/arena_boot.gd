extends Node3D
## Wires the HumanController to the player's camera once the arena is ready.

func _ready() -> void:
	var pnode: PlayerNode = $Player
	var camera: Camera3D = pnode.get_node("Camera3D")
	var hc: HumanController = $HumanController
	hc.setup(pnode, camera)
	# First-person: hide the player's own sphere so the camera (at eye level, inside the
	# sphere) isn't occluded by it. TP will re-show it in a later slice.
	pnode.get_node("Mesh").visible = false
