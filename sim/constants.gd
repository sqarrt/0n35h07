class_name MoveConst
## Movement constants — ported verbatim from web-reference/src/constants.ts.
## Dash timers are kept in MILLISECONDS (as in web Body.ts: subtract dt*1000).

const MOVE_SPEED := 7.0
const GRAVITY := -22.0
const JUMP_FORCE := 8.0
const MAX_AIR_JUMPS := 1
const GROUND_ACCEL := 16.0
const GROUND_FRICTION := 12.0
const AIR_ACCEL := 30.0
const AIR_WISH_SPEED := 1.0
const MAX_SPEED := MOVE_SPEED * 6.0
const SLOPE_MIN_NORMAL_Y := 0.1
const KCC_SLOPE_DEG := 50.0        # max climb/slide angle for the character (web KCC_SLOPE_DEG)
const AUTOSTEP_MAX_HEIGHT := 1.05  # step/ledge height the character auto-climbs (web enableAutostep)
const AUTOSTEP_MIN_WIDTH := 0.25   # min landing depth to accept a step (web AUTOSTEP_MIN_WIDTH)
const DASH_SPEED := 24.0
const DASH_DURATION_MS := 150.0
const DASH_COOLDOWN_MS := 1500.0
const WINDUP_MOVE_FACTOR := 0.25
const EYE_HEIGHT := 1.7
const BALL_RADIUS := 0.5
const MUZZLE_Y := -0.3              # muzzle origin relative to eye position (= body sphere center)
const HITBOX_Y := -0.7             # combat hitbox [1,2,1] center relative to eye (span 0..2 from floor)
const CAPSULE_RADIUS := 0.5
const CAPSULE_HALF_HEIGHT := 0.35
const CAPSULE_OFFSET_Y := -0.85
