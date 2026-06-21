import { getStatus as getRelayStatus } from './relays'
import { APP_ID } from './TrysteroNet'
import { CLIENT_VERSION, CLIENT_PLATFORM } from './poolNamespace'

/**
 * Dev diagnostics for the P2P connect. The goal is to turn ONE failed connection attempt into a single
 * copyable `window.__netReport()` report that localizes the failure layer: signaling (relays didn't overlap)
 * → ICE/NAT (no TURN) → application handshake (HELLO/ASSIGN). Mounted only in dev (see main.tsx); all mark/set
 * calls are cheap no-ops until `installNetDiag()` is called, so they're safe in prod and unit tests (no window
 * access outside install).
 */

const MAX_PCS = 8          // ring of the latest RTCPeerConnections (enough for a couple of host/client attempts)
const MAX_MARKS = 200      // ring of application handshake marks
const T0 = performance.now()
const rel = (t = performance.now()): number => Math.round(t - T0)

interface PcDiag {
  id: number
  createdAt: number
  iceServers: number
  localCandTypes: Record<string, number>
  states: Array<{ t: number; ice?: string; conn?: string; gather?: string }>
  errors: Array<{ t: number; code?: number; url?: string; text?: string }>
  selectedPair?: { local?: string; remote?: string; protocol?: string }
}
interface Mark { t: number; tag: string; data?: unknown }
interface DiagCtx { role?: string; code?: string; selfId?: string }

let installed = false
let enabled = false
const pcs: PcDiag[] = []
const marks: Mark[] = []
const ctx: DiagCtx = {}
let getPeersFn: (() => string[]) | null = null

export function netDiagSetContext(c: Partial<DiagCtx>): void { Object.assign(ctx, c) }
export function netDiagSetPeers(fn: () => string[]): void { getPeersFn = fn }
export function netDiagMark(tag: string, data?: unknown): void {
  if (!enabled) return
  marks.push({ t: rel(), tag, data })
  if (marks.length > MAX_MARKS) marks.shift()
}

/** ICE candidate type from its SDP string (`... typ srflx ...`). */
function candType(candidate: string): string {
  const m = / typ (host|srflx|prflx|relay)/.exec(candidate)
  return m ? m[1] : 'unknown'
}

// candidate-pair/candidate fields from getStats() that aren't in the standard lib.dom types.
interface PairStat { type: string; nominated?: boolean; selected?: boolean; state?: string; localCandidateId?: string; remoteCandidateId?: string }
interface CandStat { candidateType?: string; protocol?: string }

async function captureSelected(pc: RTCPeerConnection, d: PcDiag): Promise<void> {
  try {
    const stats = await pc.getStats()
    let pair: PairStat | undefined
    stats.forEach(s => {
      const p = s as unknown as PairStat
      if (p.type === 'candidate-pair' && p.state === 'succeeded' && (p.selected || p.nominated)) pair = p
    })
    if (!pair) return
    const local = pair.localCandidateId ? (stats.get(pair.localCandidateId) as unknown as CandStat | undefined) : undefined
    const remote = pair.remoteCandidateId ? (stats.get(pair.remoteCandidateId) as unknown as CandStat | undefined) : undefined
    d.selectedPair = { local: local?.candidateType, remote: remote?.candidateType, protocol: local?.protocol }
  } catch { /* getStats unavailable — not critical for the report */ }
}

function attach(pc: RTCPeerConnection, config?: RTCConfiguration): void {
  const d: PcDiag = { id: pcs.length, createdAt: rel(), iceServers: config?.iceServers?.length ?? 0, localCandTypes: {}, states: [], errors: [] }
  pcs.push(d)
  if (pcs.length > MAX_PCS) pcs.shift()
  pc.addEventListener('icecandidate', e => {
    if (e.candidate?.candidate) { const t = candType(e.candidate.candidate); d.localCandTypes[t] = (d.localCandTypes[t] ?? 0) + 1 }
  })
  pc.addEventListener('icecandidateerror', e => {
    const ev = e as RTCPeerConnectionIceErrorEvent
    d.errors.push({ t: rel(), code: ev.errorCode, url: ev.url, text: ev.errorText })
  })
  pc.addEventListener('iceconnectionstatechange', () => {
    d.states.push({ t: rel(), ice: pc.iceConnectionState })
    if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') void captureSelected(pc, d)
  })
  pc.addEventListener('connectionstatechange', () => d.states.push({ t: rel(), conn: pc.connectionState }))
  pc.addEventListener('icegatheringstatechange', () => d.states.push({ t: rel(), gather: pc.iceGatheringState }))
}

/** Human-readable verdict: which layer the failure belongs to (see the matrix in the plan). */
function summarize(): string {
  if (pcs.length === 0)
    return 'NO_RTC: RTCPeerConnection was never created → peers did not find each other (H1: relays did not overlap, or H0: appId/code did not match).'
  const connected = pcs.some(p => p.states.some(s => s.ice === 'connected' || s.ice === 'completed'))
  if (connected) {
    const assign = marks.some(m => m.tag === 'assignRecv')
    if (ctx.role === 'client' && !assign)
      return 'RTC_OK_NO_ASSIGN: WebRTC connected, but ASSIGN did not arrive (H3: application handshake).'
    return 'RTC_CONNECTED: WebRTC connection established.'
  }
  const failed = pcs.some(p => p.states.some(s => s.ice === 'failed'))
  const hasSrflx = pcs.some(p => p.localCandTypes.srflx)
  const hasRelay = pcs.some(p => p.localCandTypes.relay)
  if (failed)
    return `ICE_FAILED: SDP was exchanged, but ICE did not punch through NAT (H2). srflx=${hasSrflx} relay=${hasRelay} → ${hasRelay ? 'even TURN did not help' : 'TURN required'}.`
  return 'ICE_PENDING: connection stuck in checking/gathering — likely H2 (NAT, TURN required).'
}

function report(): unknown {
  const data = {
    diagnosis: summarize(),
    role: ctx.role, code: ctx.code, selfId: ctx.selfId,
    appId: APP_ID, version: CLIENT_VERSION, platform: CLIENT_PLATFORM,
    relays: getRelayStatus(),
    peers: getPeersFn ? getPeersFn() : [],
    handshake: marks,
    rtc: pcs,
  }
  const text = JSON.stringify(data, null, 2)
  try { void navigator.clipboard?.writeText(text) } catch { /* clipboard may be unavailable — logged below */ }
  console.log('[netReport] (copied to clipboard)\n' + text)
  return data
}

/** Install diagnostics: monkeypatch RTCPeerConnection + window.__netReport. Idempotent, dev only. */
export function installNetDiag(): void {
  if (installed) return
  installed = true
  enabled = true
  window.__netReport = report
  const Native = window.RTCPeerConnection
  if (!Native) return
  class PatchedRTC extends Native {
    constructor(...args: ConstructorParameters<typeof Native>) {
      super(...args)
      attach(this, args[0])
    }
  }
  window.RTCPeerConnection = PatchedRTC as unknown as typeof window.RTCPeerConnection
  console.log('[netDiag] installed. After a connect attempt, call __netReport() in the console (both sides).')
}
