class_name MapGeo extends Resource
## A map's compiled geometry, decoded at import time from the map editor's `<id>.geo` (base64 float arrays per chunk).
## The groups are what the game draws; `collider` is the movement trimesh. The editor also writes normals and colours
## for the collider — nothing reads them, so they are dropped here rather than shipped.

@export var groups: Array[MapGeoGroup] = []
@export var collider := PackedVector3Array()

## Every group the beam stops on (web: the raycast buckets), as one triangle soup.
func beam_faces() -> PackedVector3Array:
	var faces := PackedVector3Array()
	for group in groups:
		if group.raycast:
			faces.append_array(group.position)
	return faces
