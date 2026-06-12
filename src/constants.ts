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

// Прыжок / bhop / air-strafe — скоростная (Quake) модель: горизонтальная скорость персистентна (velH),
// на земле — трение+быстрый разгон к желаемой; в воздухе — air-accelerate с кэпом → разгон стрейфом+мышью;
// кадр прыжка пропускает трение → bhop сохраняет скорость. Прыжок — held-ввод (auto-bhop при удержании).
export const MAX_AIR_JUMPS   = 1     // воздушных прыжков (двойной прыжок: 1 с земли + 1 в воздухе)
export const GROUND_ACCEL    = 16    // ускорение к желаемой скорости на земле (множитель wishspeed·dt) — снаппи
export const GROUND_FRICTION = 12    // трение на земле (1/с); кадр прыжка трение пропускает (основа bhop)
export const AIR_ACCEL       = 30    // ускорение в воздухе (Quake air-accelerate) — набор скорости стрейфом не мгновенный
export const AIR_WISH_SPEED  = 1.0   // кэп желаемой скорости в воздухе → разгон стрейфом сверх MOVE_SPEED
export const MAX_SPEED       = MOVE_SPEED * 6   // верхний предел горизонтальной скорости (~×6 обычной) — bhop не разгоняет бесконечно
export const SLOPE_MIN_NORMAL_Y = 0.1   // мин. n.y, чтобы считать поверхность полом-склоном (а не стеной)

// Dash (рывок на Shift)
export const DASH_SPEED    = 24    // ед/с (~3.4× MOVE_SPEED)
export const DASH_DURATION = 150   // мс — длительность окна рывка
export const DASH_COOLDOWN = 1500  // мс
export const DASH_FOV      = 95    // целевой FOV во время рывка

// Отброс при пересечении игроков (импульс «как рывок, но не рывок»; вектор — 3D между центрами сфер,
// можно запрыгнуть на соперника и оттолкнуться вверх). Жёсткой коллизии игрок-игрок нет.
export const KNOCKBACK_SPEED    = 26   // ед/с — горизонтальная сила отброса (чуть мощнее рывка)
export const KNOCKBACK_DURATION = 150  // мс — длительность горизонтального окна отброса
export const KNOCKBACK_UP_SPEED = 12   // ед/с — вертикальный импульс скорости (подброс выше прыжка JUMP_FORCE=8)

// Dash trail — «клоны скорости»: полупрозрачные сферы по траектории рывка.
export const DASH_TRAIL_GHOST_COUNT    = 10    // размер пула клонов
export const DASH_TRAIL_GHOST_RADIUS   = 0.5   // = радиус сферы-тела
export const DASH_TRAIL_GHOST_INTERVAL = 16    // мс между клонами
export const DASH_TRAIL_GHOST_LIFE     = 260   // мс жизни клона
export const DASH_TRAIL_GHOST_OPACITY  = 0.4

// Сфера-тело: радиус/детализация (общие для игрового меша и превью в настройках).
export const BALL_RADIUS   = 0.5
export const BALL_SEGMENTS = 128        // высокополигональный меш — фасетки незаметны, волны гладкие
export const PREVIEW_SPIN_SPEED = 0.6   // рад/с — медленное вращение шара в превью настроек

// Модели шара (выбор в настройках; сетевая косметика — видна сопернику).
export const BALL_MODELS = ['smooth', 'waves', 'planet'] as const
export type BallModel = typeof BALL_MODELS[number]

// Анимации подготовки выстрела (выбор в настройках; сетевая косметика — видна сопернику).
export const WINDUP_STYLES = ['classic', 'rage', 'singularity'] as const
export type WindupStyle = typeof WINDUP_STYLES[number]

// Анимации респавна (смерть/призрак/возрождение; выбор во «Внешности», сетевая косметика).
export const RESPAWN_STYLES = ['echo', 'chaos', 'swarm'] as const
export type RespawnStyle = typeof RESPAWN_STYLES[number]

// Скины следа рывка и щита (выбор во «Внешности», сетевая косметика — видны сопернику).
export const DASH_STYLES = ['streak', 'wave', 'rift'] as const
export type DashStyle = typeof DASH_STYLES[number]
export const SHIELD_STYLES = ['dome', 'hex', 'crystal'] as const
export type ShieldStyle = typeof SHIELD_STYLES[number]

// Волны — деформация вершин (вдоль нормали) в шейдере:
export const BALL_WAVE_COUNT = 10     // число волн по высоте сферы
export const BALL_WAVE_AMP   = 0.03   // амплитуда волн
export const BALL_WAVE_SPEED = 3      // скорость бега волн
// Планета — кольцо вокруг сферы (локальные единицы меша-сферы, радиус 0.5):
export const BALL_RING_INNER    = 0.62  // внутренний радиус кольца
export const BALL_RING_OUTER    = 1.0   // внешний радиус кольца
export const BALL_RING_TILT_DEG = 70    // наклон кольца, градусы
export const BALL_RING_SEGMENTS = 96
export const BALL_RING_BANDS     = 5     // число банд градиента
export const BALL_RING_SCROLL    = 0.4   // скорость дрейфа банд (иллюзия движения)

// Shared entity geometry — ОДНИ И ТЕ ЖЕ смещения для игрока и ботов.
// position у Body — точка на уровне глаз (y = EYE_HEIGHT когда на земле).
export const BODY_MESH_Y  = -0.3   // центр сферы-тела относительно position
export const HITBOX_Y     = -0.7   // центр хитбокса [1,2,1] (спан 0..2 от пола)
export const MUZZLE_Y     = -0.3   // начало луча (грудь) относительно position

export const WINDUP_SCALE_GAIN = 0.4   // прирост масштаба тела во время заряда выстрела
export const WINDUP_SHRINK_MS = 200    // длительность «сдувания» шара после выстрела (ранее BOT_WINDUP/3)

// Фаза «призрака» при респауне: игрок неуязвим и быстро ищет новую точку спавна.
export const RESPAWN_GHOST_MS   = 1500  // длительность фазы (мс)
export const RESPAWN_SPEED_MULT = 2     // множитель скорости движения в фазе
export const RESPAWN_SPEED_RAMP = 0.3   // доля конца фазы, на которой ускорение плавно спадает к ×1
export const GHOST_OPACITY      = 0.4   // прозрачность шара-призрака
export const SPAWN_ANIM_MS  = 280       // материализация на месте (короткий «пуф»)
export const SPAWN_POP      = 0.25      // амплитуда упругого пуфа при материализации
// Хлопок частиц в момент смерти (world-space, цвет игрока). Гаснут сами — на динамику не влияют.
export const DEATH_BURST_COUNT   = 14
export const DEATH_BURST_RADIUS  = 0.16
export const DEATH_BURST_LIFE    = 400   // мс
export const DEATH_BURST_SPEED   = 6     // ед/с — разлёт наружу
export const DEATH_BURST_OPACITY = 0.9

// PointerLock: Chrome блокирует повторный requestPointerLock ~1.25с после выхода.
export const POINTERLOCK_COOLDOWN = 1300   // мс — кулдаун перед повторным входом (кнопка «Продолжить»)

// HUD: единый прямоугольный контур. Скобки щита (углы), полосы дэша (бока) и полосы возрождения (верх/низ)
// лежат на одной линии-периметре. Плечи скобок занимают ~21–27px от кромки → полосы ставим на тот же отступ.
export const HUD_FRAME_INSET = 21   // px от кромки экрана до полос дэша/возрождения

// Матч на время (выбор хоста в комнате). Конец матча: таймер ИЛИ отключение соперника.
export const MATCH_DURATIONS_MIN = [3, 5, 10] as const
export const DEFAULT_MATCH_DURATION_MIN = 5

// Карта матча (выбор хоста в комнате). Тип здесь (а не в game/maps.ts), чтобы net-слой не зависел от game.
// id используется и как подпись в UI.
export type MapId = 'os_arena' | 'os_india' | 'os_pillars'
export const DEFAULT_MAP_ID: MapId = 'os_arena'
export type MapFilter = MapId | 'any'
export type DurationFilter = number | 'any'

// Демпфирование анимаций меню (переезд подложки и фоновых шаров) — единая скорость («резко, но не мгновенно»,
// ~200 мс на ~95% пути). TAU в секундах для cur += (target-cur)*(1-exp(-dt/TAU)).
export const MENU_ANIM_TAU = 0.06
export const MATCH_TIME_BROADCAST_MS = 1000   // host шлёт остаток времени ~1/с

// Multiplayer (host-authoritative P2P)
export const MATCH_ROLES = ['host', 'client'] as const
export type MatchRole = typeof MATCH_ROLES[number]
// Строго 1v1: два фиксированных id игроков — хост и его единственный соперник (бот XOR клиент).
export const HOST_ID = 0
export const OPPONENT_ID = 1
export const MATCH_PHASES = ['ready', 'countdown', 'live', 'ended'] as const
export type MatchPhase = typeof MATCH_PHASES[number]
export const READY_COUNTDOWN_MS = 3000   // обратный отсчёт перед боем (1v1), мс
export const NET_REMOTE_LERP = 0.35   // сглаживание позиции удалённого игрока к последнему снапшоту
export const NET_RECONCILE_LERP = 0.15 // коррекция своего игрока к авторитету (анти-дрейф при коллизиях)
export const NET_SNAPSHOT_HZ = 30     // частота рассылки снапшотов хостом
export const NET_HUMAN_SPAWN_Z = 5    // 1v1: люди спавнятся друг напротив друга по ±Z (детерминированно)
// Палитра цветов шара (выбор в настройках + фолбэк-назначение хостом при коллизии с цветом соперника).
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

// KCC: автоступень и углы склона. Высота ступени ≥ высоты блока 1×1 (=1.0) → на блоки 1×1 всходим
// как по лестнице, а не упираемся (раньше 0.4 < 1.0).
export const AUTOSTEP_MAX_HEIGHT = 1.05
export const AUTOSTEP_MIN_WIDTH  = 0.25
export const KCC_SLOPE_DEG       = 50    // макс. угол climb/slide
export const KCC_OFFSET          = 0.01  // зазор капсула↔мир: мал → численная нестабильность KCC (дрожание на высоком FPS)
export const AUTOSTEP_LIFT_EPS   = 0.02  // порог вертикального подъёма сверх гравитации → автостеп пытался перешагнуть

// Bot colors (hex strings — create THREE.Color locally where needed)
export const BOT_COLOR_BASE  = '#5af'
export const BOT_COLOR_WHITE = '#fff'

// Bot AI difficulty
export type BotDifficulty = 'normal' | 'passive'
