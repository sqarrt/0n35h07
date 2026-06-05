import { useReducer, useCallback } from 'react'
import { useFlash } from './useFlash'
import type { MatchPhase } from '../constants'

export interface PlayerScore { name: string; kills: number; deaths: number }

export type MatchOutcome = 'win' | 'lose' | 'draw'
export type MatchEndReason = 'time' | 'disconnect'
export interface MatchResult { outcome: MatchOutcome; reason: MatchEndReason; scores: PlayerScore[] }

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
  beamFlash: boolean
  playerHit: boolean
  shieldBlock: boolean
  botShieldHit: boolean
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
  | { type: 'RESET_MATCH' }
  | { type: 'BEAM_FLASH' }
  | { type: 'PLAYER_HIT' }
  | { type: 'SHIELD_BLOCK' }
  | { type: 'BOT_SHIELD_HIT' }

const initial: Omit<HUDState, 'beamFlash' | 'playerHit' | 'shieldBlock' | 'botShieldHit'> = {
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
}

function reducer(
  state: typeof initial,
  action: Exclude<HUDAction, { type: 'BEAM_FLASH' | 'PLAYER_HIT' | 'SHIELD_BLOCK' | 'BOT_SHIELD_HIT' }>
): typeof initial {
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
    case 'RESET_MATCH':         return { ...state, matchResult: null, matchTime: null, scores: [] }
    default: return state
  }
}

export function useGameHUD(): { state: HUDState; dispatch: (action: HUDAction) => void } {
  const [base, baseDispatch] = useReducer(reducer, initial)

  const [beamFlash,    triggerBeamFlash]    = useFlash(200)
  const [playerHit,    triggerPlayerHit]    = useFlash(350)
  const [shieldBlock,  triggerShieldBlock]  = useFlash(250)
  const [botShieldHit, triggerBotShieldHit] = useFlash(200)

  const dispatch = useCallback((action: HUDAction) => {
    switch (action.type) {
      case 'BEAM_FLASH':     return triggerBeamFlash()
      case 'PLAYER_HIT':     return triggerPlayerHit()
      case 'SHIELD_BLOCK':   return triggerShieldBlock()
      case 'BOT_SHIELD_HIT': return triggerBotShieldHit()
      default:               return baseDispatch(action)
    }
  }, [triggerBeamFlash, triggerPlayerHit, triggerShieldBlock, triggerBotShieldHit])

  return {
    state: { ...base, beamFlash, playerHit, shieldBlock, botShieldHit },
    dispatch,
  }
}
