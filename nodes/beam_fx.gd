class_name BeamFx extends Node3D
## Beam visual (muzzle->end, lives BEAM_DURATION) + impact particle burst.
## Ported from web BeamWeapon beam/renderParticles (placeholder materials).

const GRAVITY := -22.0

var _beam: MeshInstance3D
var _beam_life := 0.0
var _particles: Array = []   # [{mesh, vel, life}]

func _ready() -> void:
	_beam = MeshInstance3D.new()
	var cyl := CylinderMesh.new()
	cyl.top_radius = 0.05
	cyl.bottom_radius = 0.05
	cyl.height = 1.0
	var bmat := StandardMaterial3D.new()
	bmat.albedo_color = Color(0.6, 1.0, 1.0)
	bmat.emission_enabled = true
	bmat.emission = Color(0.0, 1.0, 1.0)
	bmat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	_beam.mesh = cyl
	_beam.material_override = bmat
	_beam.visible = false
	add_child(_beam)
	var pmat := StandardMaterial3D.new()
	pmat.albedo_color = Color(1, 1, 0)
	pmat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	for i in range(CombatConst.IMPACT_PARTICLES):
		var m := MeshInstance3D.new()
		var s := SphereMesh.new()
		s.radius = 1.0
		s.height = 2.0
		m.mesh = s
		m.material_override = pmat
		m.visible = false
		add_child(m)
		_particles.append({"mesh": m, "vel": Vector3.ZERO, "life": 0.0})

func play(start: Vector3, end: Vector3) -> void:
	var mid := (start + end) * 0.5
	var length := start.distance_to(end)
	_beam.global_position = mid
	if length > 0.001:
		_beam.look_at(end, Vector3.UP)                       # -Z toward end
		_beam.rotate_object_local(Vector3(1, 0, 0), PI / 2.0)  # cylinder +Y axis -> along -Z
	_beam.scale = Vector3(1, length, 1)
	_beam.visible = true
	_beam_life = CombatConst.BEAM_DURATION_MS

func spawn_impact(point: Vector3) -> void:
	for p in _particles:
		p["mesh"].global_position = point
		p["vel"] = Vector3(
			(randf() - 0.5) * CombatConst.IMPACT_SPREAD_H,
			randf() * CombatConst.IMPACT_SPREAD_V,
			(randf() - 0.5) * CombatConst.IMPACT_SPREAD_H)
		p["life"] = 1.0
		p["mesh"].visible = true

func update_fx(dt: float) -> void:
	if _beam_life > 0.0:
		_beam_life -= dt * 1000.0
		if _beam_life <= 0.0:
			_beam.visible = false
	for p in _particles:
		if p["life"] <= 0.0:
			p["mesh"].visible = false
			continue
		p["mesh"].global_position += p["vel"] * dt
		p["vel"].y += GRAVITY * dt
		p["life"] -= dt * CombatConst.IMPACT_LIFE_DECAY
		var sc: float = maxf(0.0, p["life"]) * CombatConst.IMPACT_SCALE
		p["mesh"].scale = Vector3(sc, sc, sc)
		p["mesh"].visible = p["life"] > 0.0

func is_beam_visible() -> bool:
	return _beam.visible

func alive_particles() -> int:
	var n := 0
	for p in _particles:
		if p["life"] > 0.0:
			n += 1
	return n
