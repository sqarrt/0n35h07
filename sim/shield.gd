class_name Shield extends RefCounted
## Shield: idle -> active(duration) -> cooldown. Ported from web Shield.ts.

enum Phase { IDLE, ACTIVE, COOLDOWN }

var _phase := Phase.IDLE
var _timer := 0.0            # ms in the current phase
var _cooldown_scale := 1.0
var _skip_cooldown := false

func activate() -> void:
	if _phase != Phase.IDLE:
		return
	_phase = Phase.ACTIVE
	_timer = 0.0
	_skip_cooldown = false

func update(dt: float) -> void:
	var ms := dt * 1000.0
	if _phase == Phase.ACTIVE:
		_timer += ms
		if _timer >= CombatConst.SHIELD_DURATION_MS:
			_phase = Phase.IDLE if _skip_cooldown else Phase.COOLDOWN
			_skip_cooldown = false
			_timer = 0.0
	elif _phase == Phase.COOLDOWN:
		_timer += ms
		if _timer >= CombatConst.SHIELD_COOLDOWN_MS * _cooldown_scale:
			_phase = Phase.IDLE
			_timer = 0.0

func is_active() -> bool:
	return _phase == Phase.ACTIVE

func is_perfect_block() -> bool:
	return _phase == Phase.ACTIVE and _timer <= CombatConst.PERFECT_BLOCK_WINDOW_MS

func progress() -> float:
	if _phase == Phase.IDLE:
		return 1.0
	var total := CombatConst.SHIELD_DURATION_MS + CombatConst.SHIELD_COOLDOWN_MS * _cooldown_scale
	var elapsed: float = _timer if _phase == Phase.ACTIVE else CombatConst.SHIELD_DURATION_MS + _timer
	return clampf(elapsed / total, 0.0, 1.0)

func set_cooldown_scale(scale: float) -> void:
	_cooldown_scale = scale if scale > 0.0 else 1.0

func reset_cooldown() -> void:
	if _phase == Phase.COOLDOWN:
		_phase = Phase.IDLE
		_timer = 0.0
	elif _phase == Phase.ACTIVE:
		_skip_cooldown = true

func reset() -> void:
	_phase = Phase.IDLE
	_timer = 0.0
	_skip_cooldown = false
