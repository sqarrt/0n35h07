class_name MapGeoBuild
## The map editor's compiled geometry (`<id>.geo`: base64 Float32 arrays per chunk) turned into a MapGeo. Runs at
## import time, so the game never sees base64 or JSON: it decodes the arrays, flips the winding (three.js draws
## counter-clockwise front faces, Godot clockwise) and keeps only what the game reads.

const CHUNKS := "chunks"
const COLLIDER := "collider"
const POSITION := "position"
const NORMAL := "normal"
const COLOR := "color"
const FLOATS_PER_VEC := 3
const TRIANGLE_VERTS := 3
## The editor's four buckets in the order the game draws them: [key, transparent, raycast].
const BUCKETS := [["opaqueRaycast", false, true], ["opaqueNoRaycast", false, false],
	["transparentRaycast", true, true], ["transparentNoRaycast", true, false]]

static func from_json(geo: Dictionary) -> MapGeo:
	var built := MapGeo.new()
	for chunk in geo.get(CHUNKS, []):
		for bucket in BUCKETS:
			var group := _group(chunk.get(bucket[0]), bucket[1], bucket[2])
			if group != null:
				built.groups.append(group)
	var collider = geo.get(COLLIDER)
	if collider != null:
		built.collider = _wound_verts(collider[POSITION])   # the movement trimesh needs positions only
	return built

static func _group(source, transparent: bool, raycast: bool) -> MapGeoGroup:
	if source == null:
		return null
	var group := MapGeoGroup.new()
	group.transparent = transparent
	group.raycast = raycast
	group.position = _wound_verts(source[POSITION])
	group.normal = _wound_verts(source[NORMAL])
	group.color = _wound(_colors(source[COLOR]))
	return group

static func floats(base64: String) -> PackedFloat32Array:
	return Marshalls.base64_to_raw(base64).to_float32_array()

static func _wound_verts(base64: String) -> PackedVector3Array:
	var numbers := floats(base64)
	var out := PackedVector3Array()
	out.resize(numbers.size() / FLOATS_PER_VEC)
	for i in out.size():
		out[i] = Vector3(numbers[i * FLOATS_PER_VEC], numbers[i * FLOATS_PER_VEC + 1], numbers[i * FLOATS_PER_VEC + 2])
	return _wound(out)

static func _colors(base64: String) -> PackedColorArray:
	var numbers := floats(base64)
	var out := PackedColorArray()
	out.resize(numbers.size() / FLOATS_PER_VEC)
	for i in out.size():
		out[i] = Color(numbers[i * FLOATS_PER_VEC], numbers[i * FLOATS_PER_VEC + 1], numbers[i * FLOATS_PER_VEC + 2])
	return out

## Swapping the last two vertices of every triangle keeps each surface in place and flips which side is the front one;
## otherwise back faces render and are lit from the wrong side. Positions, normals and colours alike.
static func _wound(triangles):
	for i in range(0, triangles.size() - 2, TRIANGLE_VERTS):
		var tail = triangles[i + 1]
		triangles[i + 1] = triangles[i + 2]
		triangles[i + 2] = tail
	return triangles
