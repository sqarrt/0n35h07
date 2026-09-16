class_name MapGeoGroup extends Resource
## One drawable group of a map's compiled geometry: a triangle soup with a colour per vertex, already wound the way
## Godot wants it. `transparent` is the glass look, `raycast` says the beam stops on it (and that it gets the edge
## outline) — web's four buckets of (blocksBeam × transparent).

@export var position := PackedVector3Array()
@export var normal := PackedVector3Array()
@export var color := PackedColorArray()
@export var transparent := false
@export var raycast := false
