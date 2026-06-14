import type * as THREE from 'three'

// Дебаг-глобалы для e2e (ставит Match.installDebug / Game). Объявлены здесь, чтобы не кастовать window к any.
type Vec3Lite = { x: number; y: number; z: number }

declare global {
  interface Window {
    __debugCamera?: THREE.Camera
    __debugWindup?: () => boolean
    __debugTargetHitCount?: number
    __debugLastAnnounce?: string
    __debugAnnounces?: string[]
    __debugKnockCount?: number
    __debugBotPos?: Record<number, () => Vec3Lite>
    __debugRole?: () => string
    __debugPlayerPos?: (id: number) => Vec3Lite | null
    __debugScore?: (id: number) => { kills: number; deaths: number } | null
    __debugBodyScale?: (id: number) => number | null
    __debugPlayerSpeed?: (id: number) => number | null
    __debugForceEnd?: () => void
    __debugPhysicsReady?: () => boolean
    __debugPhase?: () => string
    __debugReady?: () => void
    __debugForceLive?: () => void
    __debugLeave?: () => void
    __debugMusic?: () => { loopIndex: number; active: string[] }
    __netReport?: () => unknown   // dev-диагностика P2P-коннекта (src/net/netDiag.ts)
  }
}

export {}
