import type * as THREE from 'three'

// Debug globals for e2e (set by Match.installDebug / Game). Declared here to avoid casting window to any.
type Vec3Lite = { x: number; y: number; z: number }

declare global {
  interface Window {
    __debugCamera?: THREE.Camera
    __debugWindup?: () => boolean
    __debugTargetHitCount?: number
    __debugAnnounces?: string[]
    __debugKnockCount?: number
    __debugBotPos?: Record<number, () => Vec3Lite>
    __debugRole?: () => string
    __debugPlayerPos?: (id: number) => Vec3Lite | null
    __debugScore?: (id: number) => { kills: number; deaths: number } | null
    __debugBodyScale?: (id: number) => number | null
    __debugPlayerSpeed?: (id: number) => number | null
    __debugForceEnd?: () => void
    __debugAnnounce?: (kind: 'catalyst' | 'double' | 'triple' | 'singularity', shooterId?: number) => void
    __debugStreak?: (id: number, count: number) => void
    __debugPlayerColor?: (id: number) => string | null
    __debugTimeScale?: (k: number) => void
    __debugKill?: (id: number) => void
    __debugRespawning?: (id: number) => boolean
    __debugSetStreak?: (id: number, count: number) => void
    __debugAudioBands?: number[] | null
    __debugPhysicsReady?: () => boolean
    __debugPhase?: () => string
    __debugReady?: () => void
    __debugForceLive?: () => void
    __debugLeave?: () => void
    __debugMusic?: () => { loopIndex: number; active: string[] }
    __debugMusicBoot?: () => { seedCode: string; radioActive: boolean; created: boolean; started: boolean; level: number }
    __netReport?: () => unknown   // dev diagnostics for the P2P connection (src/net/netDiag.ts)
  }
}

export {}
