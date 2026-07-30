class_name BeamWeapon extends RefCounted
## Beam: idle -> windup -> fire -> cooldown. Ported from web BeamWeapon.ts.
## Engine-agnostic: raycasting is delegated to an injected raycaster with
##   raycast(origin, dir, exclude_ids, pierce) -> HitResult | null

enum Phase { IDLE, WINDUP, COOLDOWN }

var just_fired := false
var outcome: Dictionary = {}      # {end, hit_entity_id, hit_point, rc_origin, rc_dir}
var has_outcome := false
var fire_seq := 0                 # increments per fire — lets the match consume outcomes independent of just_fired

var _raycaster
var _phase := Phase.IDLE
var _windup_elapsed := 0.0
var _cooldown_remaining := 0.0
var _cooldown_scale := 1.0
var _cooldown_total := CombatConst.BEAM_COOLDOWN_MS

func _init(raycaster) -> void:
	_raycaster = raycaster

func begin_windup() -> void:
	if _phase != Phase.IDLE:
		return
	_phase = Phase.WINDUP
	_windup_elapsed = 0.0

func update(dt: float, ctx: Dictionary) -> void:
	var ms := dt * 1000.0
	if _phase == Phase.WINDUP:
		_windup_elapsed += ms
		if _windup_elapsed >= CombatConst.BEAM_WINDUP_MS:
			_fire(ctx)
	elif _phase == Phase.COOLDOWN:
		_cooldown_remaining -= ms
		if _cooldown_remaining <= 0.0:
			_cooldown_remaining = 0.0
			_phase = Phase.IDLE

func _fire(ctx: Dictionary) -> void:
	_phase = Phase.COOLDOWN
	_cooldown_total = CombatConst.BEAM_COOLDOWN_MS * _cooldown_scale
	_cooldown_remaining = _cooldown_total
	_windup_elapsed = 0.0
	var origin: Vector3 = ctx["muzzle"]
	var aim: Vector3 = (ctx["aim"] as Vector3).normalized()
	var rc_origin: Vector3 = ctx.get("hit_origin", origin)
	var rc_dir: Vector3 = (ctx.get("hit_dir", aim) as Vector3).normalized()
	var exclude: Array = ctx.get("exclude_ids", [])
	var hit = _raycaster.raycast(rc_origin, rc_dir, exclude, false)
	var hit_entity_id := -1
	var hit_point = null
	var end: Vector3
	if hit != null:
		hit_entity_id = hit.entity_id
		var ahead: bool = (hit.point - origin).dot(aim) > 0.0
		end = hit.point if ahead else origin + aim * CombatConst.AIM_RANGE
		if hit_entity_id >= 0:
			hit_point = hit.point
	else:
		end = origin + aim * CombatConst.AIM_RANGE
	outcome = {"end": end, "hit_entity_id": hit_entity_id, "hit_point": hit_point,
		"rc_origin": rc_origin, "rc_dir": rc_dir}
	has_outcome = true
	just_fired = true
	fire_seq += 1

func interrupt() -> void:
	if _phase != Phase.WINDUP:
		return
	_phase = Phase.IDLE
	_windup_elapsed = 0.0

func is_winding_up() -> bool:
	return _phase == Phase.WINDUP

func windup_progress() -> float:
	return minf(_windup_elapsed / CombatConst.BEAM_WINDUP_MS, 1.0) if _phase == Phase.WINDUP else 0.0

func cooldown_progress() -> float:
	return maxf(0.0, 1.0 - _cooldown_remaining / _cooldown_total) if _phase == Phase.COOLDOWN else 1.0

func set_cooldown_scale(scale: float) -> void:
	_cooldown_scale = scale if scale > 0.0 else 1.0

func reset_cooldown() -> void:
	_cooldown_remaining = 0.0
	if _phase == Phase.COOLDOWN:
		_phase = Phase.IDLE

func clear_just_fired() -> void:
	just_fired = false

func reset() -> void:
	_phase = Phase.IDLE
	_windup_elapsed = 0.0
	_cooldown_remaining = 0.0
	just_fired = false
	has_outcome = false
	outcome = {}
