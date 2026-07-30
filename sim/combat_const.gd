class_name CombatConst
## Combat constants — ported from web-reference/src/constants.ts + BeamWeapon.ts.
## Timers in MILLISECONDS (as in web).

const BEAM_WINDUP_MS := 400.0
const BEAM_DURATION_MS := 200.0
const BEAM_COOLDOWN_MS := 1500.0
const AIM_RANGE := 100.0

const SHIELD_DURATION_MS := 800.0
const SHIELD_COOLDOWN_MS := 2000.0
const PERFECT_BLOCK_WINDOW_MS := 100.0

const IMPACT_PARTICLES := 6
const IMPACT_LIFE_DECAY := 3.0     # life units/s
const IMPACT_SCALE := 0.15         # particle size = life * this
const IMPACT_SPREAD_H := 8.0
const IMPACT_SPREAD_V := 6.0

# Collision layer bit VALUES (layer N -> 1 << (N-1)).
const LAYER_WORLD_BIT := 1         # layer 1: arena walls
const LAYER_PLAYER_BIT := 2        # layer 2: player movement capsule
const LAYER_HITBOX_BIT := 4        # layer 3: combat hitboxes
const COMBAT_RAY_MASK := LAYER_WORLD_BIT | LAYER_HITBOX_BIT   # walls block, hitboxes register
