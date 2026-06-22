/**
 * Trailer sequencer: plays EDL shots in order (countdown → replay cuts → finale) with continuous
 * music, text, HUD and title/CTA. Each shot is its own <Canvas> (keyed by index); music lives
 * here (not recreated between shots). Finale (slow-mo counter-shot) is Stage B (a title card for now).
 */
import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { Canvas } from '@react-three/fiber'
import { DemoScene } from './DemoScene'
import type { DemoHud } from './DemoScene'
import { FinaleScene } from './FinaleScene'
import { TRAILER_SHOTS, CLIP_FILES } from './trailerEdl'
import type { TrailerShot } from './trailerEdl'
import { Crosshair } from '../Crosshair'
import { MatchHud } from '../MatchHud'
import { WindupOverlay } from '../WindupOverlay'
import { DashIndicator } from '../DashIndicator'
import { ShieldBrackets } from '../ShieldBrackets'
import { RespawnOverlay } from '../RespawnOverlay'
import { StreakBanner } from '../StreakBanner'
import { CountdownOverlay } from '../CountdownOverlay'
import type { AnnounceItem } from '../../hooks/useGameHUD'
import { useSfx } from '../../sfx/SfxContext'
import { TrailerMusic } from '../../game/audio/TrailerMusic'
import { WebAudioMusicEngine } from '../../game/audio/WebAudioMusicEngine'
import type { SfxEvent } from '../../game/audio/sfx/types'
import type { DemoFile } from '../../game/demo/demoTypes'

type Clips = Record<string, DemoFile>

const TRAILER_SFX_GAIN = 0.45       // game sounds are dimmed but audible — music sits slightly ahead
const COUNTDOWN_SFX_GAIN = 1.0      // do NOT dim the countdown sound
const ECHO_TAIL_MS = 2600           // headroom for the echo tail (fadeOut+echo ~0.8s+2s) before dispose
const FIRST_TEXT_INDEX = TRAILER_SHOTS.findIndex(s => s.type === 'text')   // first cut — no "go" sound

interface ShotViewProps {
  shot: Extract<TrailerShot, { type: 'play' }>
  demo: DemoFile
  onHud: (h: DemoHud) => void
  onSfx: (e: SfxEvent) => void
  onAnnounce: (a: AnnounceItem) => void
  onReady: () => void
  onNearEnd: () => void
  onEnd: () => void
}

/** One play shot = its own <Canvas> (memoized: HUD updates must not recreate it). */
function ShotView({ shot, demo, onHud, onSfx, onAnnounce, onReady, onNearEnd, onEnd }: ShotViewProps) {
  const f0 = demo.frames[shot.ranges[0].from] ?? demo.frames[0]
  return useMemo(() => (
    <Canvas camera={{ position: f0.cam.p, fov: f0.cam.fov }} dpr={[1, 2]} gl={{ alpha: false }}
      onCreated={({ gl }) => gl.setClearColor('#05070d', 1)}>
      <DemoScene demo={demo} ranges={shot.ranges} onHud={onHud} onSfx={onSfx} onAnnounce={onAnnounce} onReady={onReady} onNearEnd={onNearEnd} onEnd={onEnd} />
    </Canvas>
  ), [shot, demo, f0, onHud, onSfx, onAnnounce, onReady, onNearEnd, onEnd])
}

/** Finale = its own <Canvas> (memoized). */
function FinaleView({ onSfx, onEnd }: { onSfx: (e: SfxEvent) => void; onEnd: () => void }) {
  return useMemo(() => (
    <Canvas camera={{ position: [0, 1.7, 10.5], fov: 55 }} dpr={[1, 2]} gl={{ alpha: false }}
      onCreated={({ gl }) => gl.setClearColor('#04050a', 1)}>
      <FinaleScene onSfx={onSfx} onEnd={onEnd} />
    </Canvas>
  ), [onSfx, onEnd])
}

interface TrailerSequencerProps {
  masterVolume: number
  onDone: () => void
}

export function TrailerSequencer({ masterVolume, onDone }: TrailerSequencerProps) {
  const sfx = useSfx()
  const sfxRef = useRef(sfx)
  sfxRef.current = sfx
  const playSfx = useCallback((e: SfxEvent) => sfxRef.current.play2D(e, TRAILER_SFX_GAIN), [])

  const [clips, setClips] = useState<Clips | null>(null)
  const [shotIndex, setShotIndex] = useState(0)
  const [hud, setHud] = useState<DemoHud | null>(null)
  const [countdownN, setCountdownN] = useState(3)
  const [showTitle, setShowTitle] = useState(false)   // title/CTA in the finale — once the beams freeze
  const [sceneReady, setSceneReady] = useState(false) // play-shot scene warmed up → lift the cover dimmer
  const onSceneReady = useCallback(() => setSceneReady(true), [])
  const [announce, setAnnounce] = useState<AnnounceItem | null>(null)
  const announceTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const onAnnounce = useCallback((a: AnnounceItem) => {
    setAnnounce(a)
    clearTimeout(announceTimer.current)
    announceTimer.current = setTimeout(() => setAnnounce(null), 2000)
  }, [])

  // Lead signal from a play shot: if the next shot is a cut (except the first), play the match-start
  // "go" sound SLIGHTLY BEFORE it appears, so the sound peak lands on the text slam-in.
  const onSceneNearEnd = useCallback(() => {
    if (TRAILER_SHOTS[shotIndex + 1]?.type === 'text' && shotIndex + 1 !== FIRST_TEXT_INDEX) {
      sfxRef.current.play2D('go', COUNTDOWN_SFX_GAIN)
    }
  }, [shotIndex])

  const doneRef = useRef(false)
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone
  const finish = useCallback(() => { if (doneRef.current) return; doneRef.current = true; onDoneRef.current() }, [])
  const advance = useCallback(() => setShotIndex(i => i + 1), [])

  // Load all clips.
  useEffect(() => {
    let alive = true
    Promise.all(Object.entries(CLIP_FILES).map(([id, file]) =>
      fetch(`${import.meta.env.BASE_URL}demos/${file}`).then(r => r.json()).then(d => [id, d] as const)))
      .then(entries => { if (alive) setClips(Object.fromEntries(entries)) })
      .catch(() => finish())
    return () => { alive = false }
  }, [finish])

  // The trailer's own music (menu track), volume = master. Preload it; START only with the countdown.
  const music = useState(() => new TrailerMusic(new WebAudioMusicEngine()))[0]
  const masterRef = useRef(masterVolume)
  masterRef.current = masterVolume
  const musicStarted = useRef(false)
  useEffect(() => {
    void music.preload().catch(() => { /* no music */ })
    // On exit: fadeOut (echo), then a delayed dispose — otherwise closing the context cuts the echo tail.
    return () => { music.stop(); setTimeout(() => music.dispose(), ECHO_TAIL_MS) }
  }, [music])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.code === 'Escape') finish() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [finish])

  const shot: TrailerShot | undefined = TRAILER_SHOTS[shotIndex]

  // End of the sequence.
  useEffect(() => { if (shotIndex >= TRAILER_SHOTS.length) finish() }, [shotIndex, finish])

  // Each new shot → cover opaque again (hide mounting/rebuild until onReady).
  useEffect(() => { setSceneReady(false) }, [shotIndex])

  // countdown: over emptiness, with sound (full volume); music kicks in on "go" (at the end), straight to full.
  useEffect(() => {
    if (!clips || shot?.type !== 'countdown') return   // wait for clips to load so sound aligns with the overlay
    const tick = () => sfxRef.current.play2D('count_tick', COUNTDOWN_SFX_GAIN)
    setCountdownN(3); tick()
    const per = shot.durationMs / 3
    const t1 = setTimeout(() => { setCountdownN(2); tick() }, per)
    const t2 = setTimeout(() => { setCountdownN(1); tick() }, per * 2)
    const t3 = setTimeout(() => {
      sfxRef.current.play2D('go', COUNTDOWN_SFX_GAIN)
      // Music starts AFTER the countdown (on "go"), not during it.
      if (!musicStarted.current) {
        musicStarted.current = true
        void music.start().then(() => music.setVolume(masterRef.current)).catch(() => { /* no music */ })
      }
      advance()
    }, shot.durationMs)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shotIndex, clips])

  // cut: hold on screen for durationMs (in/out animation inside), then advance.
  // The "go" sound plays ahead of time on the previous play shot's lead signal (see onSceneNearEnd).
  useEffect(() => {
    if (shot?.type !== 'text') return
    const t = setTimeout(advance, shot.durationMs)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shotIndex])

  // finale: the title surfaces once the beams freeze; safety exit (FinaleScene calls onEnd itself).
  // When the beams freeze we mute the music via fadeOut — the decaying echo rings as a tail under the title
  // (same trick as at match end: the track doesn't cut off abruptly).
  useEffect(() => {
    if (shot?.type !== 'finale') { setShowTitle(false); return }
    const tTitle = setTimeout(() => { setShowTitle(true); music.stop() }, 3600)
    const tEnd = setTimeout(finish, 9000)   // fallback in case FinaleScene never reaches onEnd
    return () => { clearTimeout(tTitle); clearTimeout(tEnd) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shotIndex])

  if (!clips || !shot) return <div className="trailer-root" />

  return (
    <div className="trailer-root">
      {/* countdown — over emptiness (no map): don't render Canvas, only the countdown overlay */}
      {shot.type === 'play' && (
        <>
          <ShotView key={`shot-${shotIndex}`} shot={shot} demo={clips[shot.clip]} onHud={setHud} onSfx={playSfx} onAnnounce={onAnnounce} onReady={onSceneReady} onNearEnd={onSceneNearEnd} onEnd={advance} />
          {/* Cover: hides the black mount/rebuild frame, fades out on onReady */}
          <div className={`trailer-cover${sceneReady ? ' is-hidden' : ''}`} />
        </>
      )}

      {/* Replay HUD — only in play shots */}
      {shot.type === 'play' && hud && (
        <>
          <MatchHud scores={hud.scores} matchTime={hud.matchTimeSec} roster={clips[shot.clip].roster} localId={clips[shot.clip].localId} streaks={hud.streaks} streakCounts={hud.streakCounts} />
          <Crosshair beamProgress={hud.beamProgress} />
          <WindupOverlay windupProgress={hud.windupProgress} />
          <DashIndicator dashProgress={hud.dashProgress} />
          <ShieldBrackets shieldProgress={hud.shieldProgress} shieldVisible={hud.shieldVisible} shieldBlock={false} />
          {hud.respawning && <RespawnOverlay progress={hud.respawning.progress} />}
        </>
      )}

      {shot.type === 'countdown' && <CountdownOverlay n={countdownN} />}

      {/* Cut between segments: cyberpunk text (slam-in/glitch-out), over emptiness */}
      {shot.type === 'text' && (
        <div key={`cut-${shotIndex}`} className="trailer-cut">
          <div className="trailer-cut__text" style={{ animationDuration: `${shot.durationMs}ms` }}>{shot.text}</div>
        </div>
      )}

      {shot.type === 'finale' && <FinaleView key="finale" onSfx={playSfx} onEnd={finish} />}
      {shot.type === 'finale' && showTitle && (
        <div className="trailer-title-wrap">
          <div className="trailer-title">0N35H07</div>
          <div className="trailer-tagline">ONE SHOT. ONE KILL. 1v1</div>
          <div className="trailer-cta">WISHLIST NOW ON STEAM</div>
        </div>
      )}

      <StreakBanner announce={announce} />
      <button className="trailer-skip" onClick={finish}>SKIP ▸</button>
    </div>
  )
}
