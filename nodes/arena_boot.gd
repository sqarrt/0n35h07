extends Node3D
## Wires the HumanController to the player's camera once the arena is ready.

func _ready() -> void:
	var pnode: PlayerNode = $Player
	var camera: Camera3D = pnode.get_node("Camera3D")
	var hc: HumanController = $HumanController
	hc.setup(pnode, camera)
