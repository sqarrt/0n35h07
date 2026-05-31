// Beam / weapon
export const BEAM_COOLDOWN      = 1500
export const BEAM_DURATION      = 200
export const BEAM_WINDUP        = 400
export const WINDUP_MOVE_FACTOR = 0.25
export const WINDUP_LOOK_FACTOR = 0.15

// Shield
export const SHIELD_DURATION = 800
export const SHIELD_COOLDOWN = 2000

// Player movement
export const MOVE_SPEED = 7
export const EYE_HEIGHT = 1.7
export const JUMP_FORCE = 8
export const GRAVITY    = -22
export const TP_DIST    = 4   // third-person camera distance behind player
export const TP_HEIGHT  = 2   // third-person camera height above player

// Shared entity geometry — ОДНИ И ТЕ ЖЕ смещения для игрока и ботов.
// position у Body — точка на уровне глаз (y = EYE_HEIGHT когда на земле).
export const BODY_MESH_Y  = -0.3   // центр сферы-тела относительно position
export const HITBOX_Y     = -0.7   // центр хитбокса [1,2,1] (спан 0..2 от пола)
export const MUZZLE_Y     = -0.3   // начало луча (грудь) относительно position
export const RESPAWN_DELAY = 150   // мс между смертью и репозицией (под death-flash)

// Bot
export const TARGET_SPEED        = 2.5
export const BOT_FIRE_INTERVAL   = 2500
export const BOT_WINDUP          = 600
export const BOT_SHIELD_INTERVAL = 5000
export const BOT_SHIELD_DURATION = 1500

// Arena
export const SPAWN_HALF = 14

// Физическая капсула игрока (Rapier KinematicCharacterController).
// CapsuleCollider args = [halfHeight, radius]; высота капсулы = 2*half + 2*radius = 1.7.
// Смещение вниз = halfHeight + radius = 0.85 → ступни на y=0 при точке глаз eye=1.7.
export const CAPSULE_RADIUS      = 0.5
export const CAPSULE_HALF_HEIGHT = 0.35
export const CAPSULE_OFFSET_Y    = -0.85

// Bot colors (hex strings — create THREE.Color locally where needed)
export const BOT_COLOR_BASE  = '#5af'
export const BOT_COLOR_WHITE = '#fff'

// Bot AI difficulty
export type BotDifficulty = 'normal' | 'passive'
