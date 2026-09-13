class_name AppearanceConst
## Player identity constants — ported from web-reference/src/constants.ts, settings.ts, names.ts and i18n: the colour
## palette, cosmetic style lists (order matters: seeded picks index into them), profile defaults and limits.

const PLAYER_COLORS := ["#4af", "#fa4", "#4fa", "#f4a", "#fd4", "#a4f", "#4ff", "#f55"]
const BALL_MODELS := ["smooth", "waves", "planet"]
const WINDUP_STYLES := ["classic", "rage", "singularity"]
const RESPAWN_STYLES := ["echo", "chaos", "swarm"]
const DASH_STYLES := ["streak", "wave", "rift"]
const SHIELD_STYLES := ["dome", "hex", "crystal"]
const LOCALE_IDS := ["en", "fr", "it", "de", "es", "zh-CN", "pt-BR", "ru", "tr", "pl"]
const CONNECT_TIMEOUT_OPTIONS := [5, 10, 20, 30, 60, 90, 120]
const CONNECT_TIMEOUT_DEFAULT := 10
const NAME_MAX := 16
const VIEW_FIRST_PERSON := "fp"
const VIEW_THIRD_PERSON := "tp"
const ROLE_BOTH := "both"
const ROLE_CLIENT := "client"
const VOLUME_DEFAULTS := {"master": 1.0, "sfx": 1.0, "music": 0.3, "menuMusic": 0.3, "radio": 0.8}
const BALL_ART_BYTES := 64          # web ballArt: two 16×16 one-bit sides
const BALL_ART_BASE64_LEN := 88
const FALLBACK_TEXT_COLOR := "#cfe6ff"   # web --text: a player without a roster entry
const FALLBACK_EFFECT_COLOR := "#4af"    # web EffectText colour fallback
