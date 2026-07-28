import { Crosshair } from './Crosshair'
import { ShieldBrackets } from './ShieldBrackets'
import { ScreenFlashes } from './ScreenFlashes'
import { WindupOverlay } from './WindupOverlay'
import { DashIndicator } from './DashIndicator'
import { StatsOverlay } from './StatsOverlay'
import { RespawnOverlay } from './RespawnOverlay'
import { MatchHud } from './MatchHud'
import { StreakBanner } from './StreakBanner'
import { EffectDefs } from './EffectText'
import { OverheatVignette } from './OverheatVignette'
import { ReadyOverlay } from './ReadyOverlay'
import { CountdownOverlay } from './CountdownOverlay'
import { MatchEndedOverlay } from './MatchEndedOverlay'
import { AudioBar } from './AudioBar'
import type { HUDState } from '../hooks/useGameHUD'
import type { RosterEntry } from '../net/protocol'
import type { AudioAnalysis } from '../game/audio/AudioAnalysis'

/** The whole DOM overlay above the match canvas: phase rituals, the live HUD and the end screen. */
interface GameOverlayProps {
  hud: HUDState
  roster: RosterEntry[]
  localId: number
  locked: boolean          // pointer captured — the live HUD only makes sense while playing
  showFps: boolean
  showSpeed: boolean
  audioViz: boolean
  audioAnalysis: AudioAnalysis
  onReady: () => void
  onExit: () => void
}

export function GameOverlay({ hud, roster, localId, locked, showFps, showSpeed, audioViz, audioAnalysis, onReady, onExit }: GameOverlayProps) {
  const live = locked && hud.matchPhase === 'live'
  return (
    <>
      {hud.matchPhase === 'ready' && <ReadyOverlay roster={roster} localId={localId} ready={hud.ready} onReady={onReady} />}
      {hud.matchPhase === 'countdown' && <CountdownOverlay n={hud.countdown} />}
      {/* Game HUD — only in live; during the countdown a clean screen (camera can turn) + the countdown itself. */}
      {live && (
        <>
          <WindupOverlay windupProgress={hud.windupProgress} />
          <Crosshair beamProgress={hud.beamProgress} />
          <ScreenFlashes
            beamFlash={hud.beamFlash}
            playerHit={hud.playerHit}
            shieldBlock={hud.shieldBlock}
            botShieldHit={hud.botShieldHit}
            shieldVisible={hud.shieldVisible}
          />
          <ShieldBrackets
            shieldProgress={hud.shieldProgress}
            shieldVisible={hud.shieldVisible}
            shieldBlock={hud.shieldBlock}
          />
          <DashIndicator dashProgress={hud.dashProgress} />
          <StatsOverlay showFps={showFps} showSpeed={showSpeed} speed={hud.playerSpeed} />
          {hud.respawning && <RespawnOverlay progress={hud.respawning.progress} />}
          {audioViz && <AudioBar analysis={audioAnalysis} />}
          <StreakBanner announce={hud.announce} />
          <OverheatVignette tier={hud.streaks[localId] ?? null} />
          <EffectDefs />
        </>
      )}
      {/* HUD bar: at the top in live (when the pointer is captured). At match end the overlay owns the
          screen (ranked player list) — the bar hides so nothing overlaps it. */}
      {live && !hud.matchResult && (
        <MatchHud scores={hud.scores} matchTime={hud.matchTime} roster={roster} localId={localId} streaks={hud.streaks} streakCounts={hud.streakCounts} />
      )}
      {hud.matchResult && (
        <MatchEndedOverlay result={hud.matchResult} roster={roster} streaks={hud.streaks} onExit={onExit} />
      )}
    </>
  )
}
