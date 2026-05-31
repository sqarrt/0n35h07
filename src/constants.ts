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
export const AIM_RANGE  = 100   // дальность луча прицела/выстрела при промахе (ед.)
export const EYE_HEIGHT = 1.7
export const JUMP_FORCE = 8
export const GRAVITY    = -22
export const TP_DIST    = 4   // third-person camera distance behind player
export const TP_HEIGHT  = 2   // third-person camera height above player

// Dash (рывок на Shift)
export const DASH_SPEED    = 24    // ед/с (~3.4× MOVE_SPEED)
export const DASH_DURATION = 150   // мс — длительность окна рывка
export const DASH_COOLDOWN = 1500  // мс
export const DASH_FOV      = 95    // целевой FOV во время рывка

// Dash trail — «клоны скорости»: полупрозрачные сферы по траектории рывка.
export const DASH_TRAIL_GHOST_COUNT    = 10    // размер пула клонов
export const DASH_TRAIL_GHOST_RADIUS   = 0.5   // = радиус сферы-тела
export const DASH_TRAIL_GHOST_INTERVAL = 16    // мс между клонами
export const DASH_TRAIL_GHOST_LIFE     = 260   // мс жизни клона
export const DASH_TRAIL_GHOST_OPACITY  = 0.4

// Shared entity geometry — ОДНИ И ТЕ ЖЕ смещения для игрока и ботов.
// position у Body — точка на уровне глаз (y = EYE_HEIGHT когда на земле).
export const BODY_MESH_Y  = -0.3   // центр сферы-тела относительно position
export const HITBOX_Y     = -0.7   // центр хитбокса [1,2,1] (спан 0..2 от пола)
export const MUZZLE_Y     = -0.3   // начало луча (грудь) относительно position
export const RESPAWN_DELAY = 150   // мс между смертью и репозицией (под death-flash)

export const WINDUP_SCALE_GAIN = 0.4   // прирост масштаба тела во время заряда выстрела

// PointerLock: Chrome блокирует повторный requestPointerLock ~1.25с после выхода.
export const POINTERLOCK_COOLDOWN = 1300   // мс — кулдаун перед повторным входом (кнопка «Продолжить»)

// Multiplayer (host-authoritative P2P)
export const MATCH_ROLES = ['local', 'host', 'client'] as const
export type MatchRole = typeof MATCH_ROLES[number]
export const NET_REMOTE_LERP = 0.35   // сглаживание позиции удалённого игрока к последнему снапшоту
export const NET_SNAPSHOT_HZ = 30     // частота рассылки снапшотов хостом
export const BOT_TEAM = -1            // общая команда всех ботов (нет дружественного огня бот-в-бота)
export const NET_HUMAN_SPAWN_Z = 5    // 1v1: люди спавнятся друг напротив друга по ±Z (детерминированно)
export const MAX_PLAYERS = 4          // людей+ботов в лобби
// Палитра цветов шара (выбор в настройках + фолбэк-назначение хостом при коллизии). ≥ MAX_PLAYERS.
export const PLAYER_COLORS = ['#4af', '#fa4', '#4fa', '#f4a', '#fd4', '#a4f', '#4ff', '#f55']
// TURN-хук: пусто = только STUN (хватает домашним сетям). Добавь серверы для мобильных/CGNAT.
export const NET_ICE_SERVERS: RTCIceServer[] = []

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
