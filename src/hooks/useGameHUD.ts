import { useReducer, useCallback } from 'react'
import { useFlash } from './useFlash'
import { usePayloadFlash } from './usePayloadFlash'
import type { MatchPhase } from '../constants'
import type { StreakTier, AnnounceKind } from '../game/streak'

export interface PlayerScore { name: string; kills: number; deaths: number }

export type MatchOutcome = 'win' | 'lose' | 'draw'
export type MatchEndReason = 'time' | 'disconnect'
export interface MatchResult { outcome: MatchOutcome; reason: MatchEndReason; scores: PlayerScore[] }

/** Снимок для transient-баннера серии/CATALYST. */
export interface AnnounceItem { name: string; color: string; kind: AnnounceKind }

export interface HUDState {
  beamProgress: number
  shieldProgress: number
  dashProgress: number
  playerSpeed: number
  shieldVisible: boolean
  windupProgress: number
  scores: PlayerScore[]
  matchPhase: MatchPhase
  ready: number[]
  countdown: number
  matchTime: number | null
  matchResult: MatchResult | null
  respawning: { progress: number } | null
  streaks: Record<number, StreakTier | null>   // постоянная подсветка ника по серии (id → тир)
  beamFlash: boolean
  playerHit: boolean
  shieldBlock: boolean
  botShieldHit: boolean
  announce: AnnounceItem | null                 // transient-баннер серии/CATALYST
}

export type HUDAction =
  | { type: 'SET_BEAM_PROGRESS';   value: number }
  | { type: 'SET_SHIELD_PROGRESS'; value: number }
  | { type: 'SET_DASH_PROGRESS';   value: number }
  | { type: 'SET_PLAYER_SPEED';    value: number }
  | { type: 'SET_SHIELD_VISIBLE';  value: boolean }
  | { type: 'SET_WINDUP_PROGRESS'; value: number }
  | { type: 'SET_SCORES';          scores: PlayerScore[] }
  | { type: 'SET_MATCH_PHASE';     phase: MatchPhase; ready: number[]; countdown: number }
  | { type: 'SET_RESPAWNING';      progress: number | null }
  | { type: 'SET_MATCH_TIME';      seconds: number | null }
  | { type: 'SET_MATCH_RESULT';    result: MatchResult }
  | { type: 'SET_STREAK';          id: number; tier: StreakTier | null }
  | { type: 'RESET_MATCH' }
  | { type: 'BEAM_FLASH' }
  | { type: 'PLAYER_HIT' }
  | { type: 'SHIELD_BLOCK' }
  | { type: 'BOT_SHIELD_HIT' }
  | { type: 'ANNOUNCE';            name: string; color: string; kind: AnnounceKind }

/** Persistent-часть стейта (без transient: флэши + announce живут в хуках). */
export type HUDBase = Omit<HUDState, 'beamFlash' | 'playerHit' | 'shieldBlock' | 'botShieldHit' | 'announce'>

export const initialHUD: HUDBase = {
  beamProgress: 1,
  shieldProgress: 1,
  dashProgress: 1,
  playerSpeed: 0,
  shieldVisible: false,
  windupProgress: 0,
  scores: [],
  matchPhase: 'live' as MatchPhase,
  ready: [] as number[],
  countdown: 0,
  matchTime: null as number | null,
  matchResult: null as MatchResult | null,
  respawning: null as { progress: number } | null,
  streaks: {},
}

/** Действия, идущие в reducer (без transient-флэшей и ANNOUNCE — те перехватывает обёртка dispatch). */
export type HUDReducerAction = Exclude<HUDAction, { type: 'BEAM_FLASH' | 'PLAYER_HIT' | 'SHIELD_BLOCK' | 'BOT_SHIELD_HIT' | 'ANNOUNCE' }>

export function hudReducer(state: HUDBase, action: HUDReducerAction): HUDBase {
  switch (action.type) {
    case 'SET_BEAM_PROGRESS':   return { ...state, beamProgress:   action.value }
    case 'SET_SHIELD_PROGRESS': return { ...state, shieldProgress: action.value }
    case 'SET_DASH_PROGRESS':   return { ...state, dashProgress:   action.value }
    case 'SET_PLAYER_SPEED':    return { ...state, playerSpeed:    action.value }
    case 'SET_SHIELD_VISIBLE':  return { ...state, shieldVisible:  action.value }
    case 'SET_WINDUP_PROGRESS': return { ...state, windupProgress: action.value }
    case 'SET_SCORES':          return { ...state, scores:        action.scores }
    case 'SET_MATCH_PHASE':     return { ...state, matchPhase: action.phase, ready: action.ready, countdown: action.countdown }
    case 'SET_RESPAWNING':      return { ...state, respawning: action.progress === null ? null : { progress: action.progress } }
    case 'SET_MATCH_TIME':      return { ...state, matchTime: action.seconds }
    case 'SET_MATCH_RESULT':    return { ...state, matchResult: action.result }
    case 'SET_STREAK':          return { ...state, streaks: { ...state.streaks, [action.id]: action.tier } }
    case 'RESET_MATCH':         return { ...state, matchResult: null, matchTime: null, scores: [], respawning: null, streaks: {} }
    default: return state
  }
}

export function useGameHUD(): { state: HUDState; dispatch: (action: HUDAction) => void } {
  const [base, baseDispatch] = useReducer(hudReducer, initialHUD)

  const [beamFlash,    triggerBeamFlash]    = useFlash(200)
  const [playerHit,    triggerPlayerHit]    = useFlash(350)
  const [shieldBlock,  triggerShieldBlock]  = useFlash(250)
  const [botShieldHit, triggerBotShieldHit] = useFlash(200)
  const [announce,     triggerAnnounce]     = usePayloadFlash<AnnounceItem>(2000)

  const dispatch = useCallback((action: HUDAction) => {
    switch (action.type) {
      case 'BEAM_FLASH':     return triggerBeamFlash()
      case 'PLAYER_HIT':     return triggerPlayerHit()
      case 'SHIELD_BLOCK':   return triggerShieldBlock()
      case 'BOT_SHIELD_HIT': return triggerBotShieldHit()
      case 'ANNOUNCE':       return triggerAnnounce({ name: action.name, color: action.color, kind: action.kind })
      case 'RESET_MATCH':    triggerAnnounce(null); return baseDispatch(action)
      default:               return baseDispatch(action)
    }
  }, [triggerBeamFlash, triggerPlayerHit, triggerShieldBlock, triggerBotShieldHit, triggerAnnounce])

  return {
    state: { ...base, beamFlash, playerHit, shieldBlock, botShieldHit, announce },
    dispatch,
  }
}
