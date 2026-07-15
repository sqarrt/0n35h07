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
export const AIM_RANGE  = 100   // aim/shot beam range on a miss (units)
export const EYE_HEIGHT = 1.7
export const JUMP_FORCE = 8
export const GRAVITY    = -22
export const TP_DIST       = 4    // third-person camera distance behind player
export const TP_HEIGHT     = 1.5  // third-person camera height above player
export const TP_SHOULDER_X = 0.7  // camera offset to the right (over-the-shoulder, God-of-War style)

// Jump / bhop / air-strafe — a speed (Quake) model: horizontal speed is persistent (velH),
// on the ground — friction + fast accel toward the wish speed; in the air — air-accelerate with a cap → gain speed via strafe+mouse;
// the jump frame skips friction → bhop preserves speed. Jump is a held input (auto-bhop while held).
export const MAX_AIR_JUMPS   = 1     // air jumps (double jump: 1 from ground + 1 in air)
export const GROUND_ACCEL    = 16    // accel toward wish speed on the ground (wishspeed·dt multiplier) — snappy
export const GROUND_FRICTION = 12    // ground friction (1/s); the jump frame skips friction (basis of bhop)
export const AIR_ACCEL       = 30    // air accel (Quake air-accelerate) — gaining speed via strafe isn't instant
export const AIR_WISH_SPEED  = 1.0   // wish-speed cap in the air → strafe accel beyond MOVE_SPEED
export const MAX_SPEED       = MOVE_SPEED * 6   // upper bound on horizontal speed (~×6 of normal) — bhop doesn't accelerate forever
export const SLOPE_MIN_NORMAL_Y = 0.1   // min n.y to treat a surface as floor/slope (not a wall)

// Dash (Shift dash)
export const DASH_SPEED    = 24    // units/s (~3.4× MOVE_SPEED)
export const DASH_DURATION = 150   // ms — dash window duration
export const DASH_COOLDOWN = 1500  // ms
export const DASH_FOV      = 95    // target FOV during the dash

// Knockback when players overlap (a "dash-like but not a dash" impulse; vector is 3D between sphere centers,
// you can jump onto an opponent and push off upward). There's no hard player-player collision.
export const KNOCKBACK_SPEED    = 26   // units/s — horizontal knockback force (slightly stronger than a dash)
export const KNOCKBACK_DURATION = 150  // ms — horizontal knockback window duration
export const KNOCKBACK_UP_SPEED = 12   // units/s — vertical velocity impulse (lift higher than JUMP_FORCE=8)

// Dash trail — "speed clones": translucent spheres along the dash path.
export const DASH_TRAIL_GHOST_COUNT    = 10    // clone pool size
export const DASH_TRAIL_GHOST_RADIUS   = 0.5   // = body sphere radius
export const DASH_TRAIL_GHOST_INTERVAL = 16    // ms between clones
export const DASH_TRAIL_GHOST_LIFE     = 260   // ms clone lifetime
export const DASH_TRAIL_GHOST_OPACITY  = 0.4

// Body sphere: radius/detail (shared by the game mesh and the settings preview).
export const BALL_RADIUS   = 0.5
export const BALL_SEGMENTS = 128        // high-poly mesh — facets are invisible, waves are smooth
export const BLOCK_TRANSPARENT_OPACITY = 0.2   // opacity of translucent map blocks (game/editor/trailer)
export const VOXEL = 0.5   // edge of the base map cube — shared editor/game grid (cube grid)
export const PREVIEW_SPIN_SPEED = 0.6   // rad/s — slow ball spin in the settings preview

// Ball models (chosen in settings; networked cosmetic — visible to the opponent).
export const BALL_MODELS = ['smooth', 'waves', 'planet'] as const
export type BallModel = typeof BALL_MODELS[number]

// Shot windup animations (chosen in settings; networked cosmetic — visible to the opponent).
export const WINDUP_STYLES = ['classic', 'rage', 'singularity'] as const
export type WindupStyle = typeof WINDUP_STYLES[number]

// Respawn animations (death/ghost/revive; chosen in "Appearance", networked cosmetic).
export const RESPAWN_STYLES = ['echo', 'chaos', 'swarm'] as const
export type RespawnStyle = typeof RESPAWN_STYLES[number]

// Dash-trail and shield skins (chosen in "Appearance", networked cosmetic — visible to the opponent).
export const DASH_STYLES = ['streak', 'wave', 'rift'] as const
export type DashStyle = typeof DASH_STYLES[number]
export const SHIELD_STYLES = ['dome', 'hex', 'crystal'] as const
export type ShieldStyle = typeof SHIELD_STYLES[number]

// Waves — vertex displacement (along the normal) in the shader:
export const BALL_WAVE_COUNT = 10     // number of waves over the sphere's height
export const BALL_WAVE_AMP   = 0.03   // wave amplitude
export const BALL_WAVE_SPEED = 3      // wave travel speed
// Planet — a ring around the sphere (local sphere-mesh units, radius 0.5):
export const BALL_RING_INNER    = 0.62  // ring inner radius
export const BALL_RING_OUTER    = 1.0   // ring outer radius
export const BALL_RING_TILT_DEG = 70    // ring tilt, degrees
export const BALL_RING_SEGMENTS = 96
export const BALL_RING_BANDS     = 5     // number of gradient bands
export const BALL_RING_SCROLL    = 0.4   // band drift speed (illusion of motion)

// Shared entity geometry — THE SAME offsets for the player and bots.
// Body's position is the eye-level point (y = EYE_HEIGHT when on the ground).
export const BODY_MESH_Y  = -0.3   // body sphere center relative to position
export const HITBOX_Y     = -0.7   // hitbox [1,2,1] center (span 0..2 from the floor)
export const MUZZLE_Y     = -0.3   // ball center relative to position (= BODY_MESH_Y)

export const WINDUP_SCALE_GAIN = 0.4   // body scale gain while charging a shot
export const WINDUP_SHRINK_MS = 200    // duration of the ball "deflate" after a shot

// "Ghost" phase on respawn: the player is invulnerable and quickly seeks a new spawn point.
export const RESPAWN_GHOST_MS   = 1500  // phase duration (ms)
export const RESPAWN_SPEED_MULT = 2     // movement speed multiplier during the phase
export const RESPAWN_SPEED_RAMP = 0.3   // fraction of the phase's end where the speedup smoothly decays to ×1
export const GHOST_OPACITY      = 0.4   // ghost ball opacity
export const SPAWN_ANIM_MS  = 280       // in-place materialization (a short "poof")
export const SPAWN_POP      = 0.25      // elastic poof amplitude on materialization
// Particle burst at the moment of death (world-space, player color). Fade on their own — don't affect dynamics.
export const DEATH_BURST_COUNT   = 14
export const DEATH_BURST_RADIUS  = 0.16
export const DEATH_BURST_LIFE    = 400   // ms
export const DEATH_BURST_SPEED   = 6     // units/s — outward scatter
export const DEATH_BURST_OPACITY = 0.9

// PointerLock: Chrome blocks a repeat requestPointerLock for ~1.25s after exit.
export const POINTERLOCK_COOLDOWN = 1300   // ms — cooldown before re-entry (the "Resume" button)

// HUD: a single rectangular outline. Shield brackets (corners), dash bars (sides) and respawn bars (top/bottom)
// lie on the same perimeter line. Bracket arms span ~21–27px from the edge → place the bars at the same inset.
export const HUD_FRAME_INSET = 21   // px from the screen edge to the dash/respawn bars

// Timed match (host's choice in the room). Match end: timer OR opponent disconnect.
export const MATCH_DURATIONS_MIN = [3, 5, 10] as const
export const DEFAULT_MATCH_DURATION_MIN = 5

// Match map (host's choice in the room). The type lives here (not in game/maps.ts) so the net layer doesn't depend on game.
// id is also used as a label in the UI.
// os_test пока не в игре (дошлифовывается): файлы src/maps/os_test/* на месте и открываются в #editor,
// но карта вне реестра — её не выбрать в лобби. Вернуть в игру = дописать id сюда, в MAPS и MAP_IDS.
export type MapId = 'os_arena' | 'os_india' | 'os_pillars' | 'os_pool_day'
export const DEFAULT_MAP_ID: MapId = 'os_arena'
export type MapFilter = MapId[]        // selected set of maps (≥1)
export type DurationFilter = number[]  // selected set of durations (≥1)

// Menu animation damping (the backdrop slide and background balls) — a single speed ("snappy but not instant",
// ~200ms to ~95% of the way). TAU in seconds for cur += (target-cur)*(1-exp(-dt/TAU)).
export const MENU_ANIM_TAU = 0.06
export const MATCH_TIME_BROADCAST_MS = 1000   // host broadcasts the time remaining ~1/s

// Multiplayer (symmetric-mesh P2P)
// Player id === seat index. The lobby creator always occupies seat 0.
export const HOST_ID = 0
// Legacy of the strict-1v1 era: seat 1. Production code must not reference it (seats are dynamic);
// kept only for the 1v1 unit tests' readability.
export const OPPONENT_ID = 1
export const MATCH_PHASES = ['ready', 'countdown', 'live', 'ended'] as const
export type MatchPhase = typeof MATCH_PHASES[number]
export const READY_COUNTDOWN_MS = 3000   // countdown before the fight, ms
export const NET_INTERP_DELAY_MS = 100   // render remotes this far in the PAST (≈2–3 snapshots at 30 Hz) — absorbs packet jitter (entity interpolation)
export const NET_SNAPSHOT_HZ = 30     // per-peer snapshot broadcast rate (each peer sends the players it owns)
// Fixed-tick simulation (netcode foundation). The sim advances only in whole FIXED_DT steps, independent of refresh.
export const FIXED_DT = 1 / 60          // 60 Hz simulation tick
export const MAX_FRAME_DT = 0.25        // clamp a render-frame spike (tab resume / WASM load) before accumulating
export const MAX_CATCHUP_STEPS = 5      // most sim ticks per render frame — spiral-of-death guard (shed the rest)
// Input clock sync (client→host): keep the host's input jitter-buffer near TARGET so it never starves (a gap → the
// using the buffer depth the host echoes in each snapshot. Gentle gain + a tight per-frame clamp keep it stable.
export const NET_PREDICT_KILL_MS = 250            // client holds a predicted opponent-death this long, ignoring snapshots that still show it alive (in-flight, pre-claim), until the host's 'kill' confirms or this grace expires (host rejected → revive)
// Ball color palette (personal appearance; never substituted — see colors-rework).
export const PLAYER_COLORS = ['#4af', '#fa4', '#4fa', '#f4a', '#fd4', '#a4f', '#4ff', '#f55']
// Team identity lives ONLY on nameplates (2v2): fixed pair, deliberately outside PLAYER_COLORS semantics.
export const TEAM_COLORS: [string, string] = ['#37f', '#f53']
export const NAMEPLATE_NEUTRAL_COLOR = '#ccc'   // FFA plates: everyone is an enemy, color codes nothing
// Nameplates over remote players (2v2: team color; FFA: neutral; 1v1: none).
export const NAMEPLATE_HEIGHT = 1.35                       // above the ball center (world units)
export const NAMEPLATE_SCALE: [number, number] = [1.6, 0.4]  // sprite world size (w, h)
// Mode spawn rules (see src/game/spawns.ts): 2v2 cluster offsets and the FFA scatter distance.
export const SPAWN_CLUSTER_OFFSETS: ReadonlyArray<readonly [number, number]> = [[-0.9, 0], [0.9, 0]]  // XZ offsets inside a 2v2 team cluster (keep capsules apart)
export const FFA_SPAWN_MIN_DIST = 6      // min pairwise distance between FFA start positions
// ICE servers for WebRTC. Passed into Trystero rtcConfig and REPLACE its defaults — so we keep both
// STUN and TURN here. STUN suffices for home networks; TURN is needed for symmetric NAT/CGNAT and networks that
// cut UDP (where STUN times out — see the online diagnostics). turns:443?transport=tcp punches through UDP filtering.
//
// TURN creds come from env (.env, gitignored; in CI — GitHub Actions secrets), NOT in the repo. The relay host is
// not a secret; the secret is username/credential. No creds → STUN-only (home networks connect, symmetric NAT won't).
// NOTE: env only removes the creds from the REPOSITORY — they still end up in the built client and are visible in
// DevTools (static TURN creds can't be hidden on the frontend). For production — a dedicated TURN with ephemeral creds
// (TURN REST/HMAC) or managed (Metered/Twilio/Cloudflare)/self-hosted coturn with limits for the load.
const TURN_HOST = 'global.relay.metered.ca'
const TURN_USERNAME = import.meta.env.VITE_TURN_USERNAME
const TURN_CREDENTIAL = import.meta.env.VITE_TURN_CREDENTIAL
const turnServers: RTCIceServer[] = TURN_USERNAME && TURN_CREDENTIAL
  ? [
      { urls: `turn:${TURN_HOST}:80`, username: TURN_USERNAME, credential: TURN_CREDENTIAL },
      { urls: `turn:${TURN_HOST}:80?transport=tcp`, username: TURN_USERNAME, credential: TURN_CREDENTIAL },
      { urls: `turn:${TURN_HOST}:443`, username: TURN_USERNAME, credential: TURN_CREDENTIAL },
      { urls: `turns:${TURN_HOST}:443?transport=tcp`, username: TURN_USERNAME, credential: TURN_CREDENTIAL },
    ]
  : []
export const NET_ICE_SERVERS: RTCIceServer[] = [
  // Public STUN (Google/Cloudflare) — yields an srflx candidate fast and reliably; first, so the direct path
  // is found before the slow relay.
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] },
  ...turnServers,
]

// Bot movement & combat
export const BOT_MOVE_SPEED      = 2.5
export const BOT_SHIELD_INTERVAL = 5000   // how often the AI decides to raise the shield (not shield duration — that matches the player)
export const BOT_CHASE_DIST      = 8      // CHASE ↔ STRAFE switch distance (units)
export const BOT_RETREAT_MS      = 500    // ms of retreat after its own shot
export const BOT_DODGE_THRESH    = 0.25  // opponent's windupProgress → initiate DODGE
export const BOT_EVADE_NEAR      = 6      // "point-blank" distance for the EVADE bunny-hop (units)
export const BOT_EVADE_DASH_RATE = 1.5   // base dash rate per second in EVADE (×evadeSkill)
export const BOT_BAIT_LATE_PROGRESS = 0.55  // windupProgress from which a charge counts as "late" for baiting
export const BOT_BAIT_COOLDOWN_MS   = 4000  // ms between shield baits (anti-loop)

// Arena
export const SPAWN_HALF = 14

// Player physics capsule (Rapier KinematicCharacterController).
// CapsuleCollider args = [halfHeight, radius]; capsule height = 2*half + 2*radius = 1.7.
// Downward offset = halfHeight + radius = 0.85 → feet at y=0 with the eye point eye=1.7.
export const CAPSULE_RADIUS      = 0.5
export const CAPSULE_HALF_HEIGHT = 0.35
export const CAPSULE_OFFSET_Y    = -0.85

// KCC: autostep and slope angles. Step height ≥ height of a 1×1 block (=1.0) → we climb 1×1 blocks
// like stairs instead of getting stuck (was 0.4 < 1.0).
export const AUTOSTEP_MAX_HEIGHT = 1.05
export const AUTOSTEP_MIN_WIDTH  = 0.25
export const KCC_SLOPE_DEG       = 50    // max climb/slide angle
export const KCC_OFFSET          = 0.01  // capsule↔world gap: too small → KCC numerical instability (jitter at high FPS)
export const AUTOSTEP_LIFT_EPS   = 0.02  // vertical-lift threshold above gravity → autostep tried to step over

// Bot colors (hex strings — create THREE.Color locally where needed)
export const BOT_COLOR_WHITE = '#fff'

// Bot AI difficulty
export type BotDifficulty = 'normal' | 'passive'
