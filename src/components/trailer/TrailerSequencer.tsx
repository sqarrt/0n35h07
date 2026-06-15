/**
 * Секвенсор трейлера: проигрывает шоты EDL по порядку (countdown → нарезка реплея → финал) с непрерывной
 * музыкой, текстом, HUD и титулом/CTA. Каждый шот — отдельный <Canvas> (ключ по индексу), музыка живёт
 * здесь (не пересоздаётся между шотами). Финал (slow-mo встречный выстрел) — Stage B (пока титул-карта).
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

const TRAILER_SFX_GAIN = 0.45       // игровые звуки приглушены, но слышны — музыка чуть впереди
const COUNTDOWN_SFX_GAIN = 1.0      // звук обратного отсчёта НЕ приглушаем
const ECHO_TAIL_MS = 2600           // запас на хвост эха (fadeOut+эхо ~0.8с+2с) перед dispose
const FIRST_TEXT_INDEX = TRAILER_SHOTS.findIndex(s => s.type === 'text')   // первая перебивка — без звука «go»

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

/** Один play-шот = свой <Canvas> (мемоизирован: HUD-апдейты не должны его пересоздавать). */
function ShotView({ shot, demo, onHud, onSfx, onAnnounce, onReady, onNearEnd, onEnd }: ShotViewProps) {
  const f0 = demo.frames[shot.ranges[0].from] ?? demo.frames[0]
  return useMemo(() => (
    <Canvas camera={{ position: f0.cam.p, fov: f0.cam.fov }} dpr={[1, 2]} gl={{ alpha: false }}
      onCreated={({ gl }) => gl.setClearColor('#05070d', 1)}>
      <DemoScene demo={demo} ranges={shot.ranges} onHud={onHud} onSfx={onSfx} onAnnounce={onAnnounce} onReady={onReady} onNearEnd={onNearEnd} onEnd={onEnd} />
    </Canvas>
  ), [shot, demo, f0, onHud, onSfx, onAnnounce, onReady, onNearEnd, onEnd])
}

/** Финал = свой <Canvas> (мемоизирован). */
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
  const [showTitle, setShowTitle] = useState(false)   // титул/CTA в финале — когда лучи замерли
  const [sceneReady, setSceneReady] = useState(false) // сцена play-шота прогрелась → снять ковер-затемнение
  const onSceneReady = useCallback(() => setSceneReady(true), [])
  const [announce, setAnnounce] = useState<AnnounceItem | null>(null)
  const announceTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const onAnnounce = useCallback((a: AnnounceItem) => {
    setAnnounce(a)
    clearTimeout(announceTimer.current)
    announceTimer.current = setTimeout(() => setAnnounce(null), 2000)
  }, [])

  // Лид-сигнал из play-шота: если следующий шот — перебивка (кроме первой), играем звук начала матча
  // «go» ЧУТЬ РАНЬШЕ её появления, чтобы пик звука попал в слэм-ин текста.
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

  // Загрузка всех клипов.
  useEffect(() => {
    let alive = true
    Promise.all(Object.entries(CLIP_FILES).map(([id, file]) =>
      fetch(`${import.meta.env.BASE_URL}demos/${file}`).then(r => r.json()).then(d => [id, d] as const)))
      .then(entries => { if (alive) setClips(Object.fromEntries(entries)) })
      .catch(() => finish())
    return () => { alive = false }
  }, [finish])

  // Своя музыка трейлера (композиция меню), громкость = master. Преднагружаем; СТАРТ — только с отсчётом.
  const music = useState(() => new TrailerMusic(new WebAudioMusicEngine()))[0]
  const masterRef = useRef(masterVolume)
  masterRef.current = masterVolume
  const musicStarted = useRef(false)
  useEffect(() => {
    void music.preload().catch(() => { /* без музыки */ })
    // На выходе: fadeOut (эхо), затем dispose с задержкой — иначе закрытие контекста срежет хвост эха.
    return () => { music.stop(); setTimeout(() => music.dispose(), ECHO_TAIL_MS) }
  }, [music])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.code === 'Escape') finish() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [finish])

  const shot: TrailerShot | undefined = TRAILER_SHOTS[shotIndex]

  // Конец последовательности.
  useEffect(() => { if (shotIndex >= TRAILER_SHOTS.length) finish() }, [shotIndex, finish])

  // Каждый новый шот → ковер снова непрозрачный (скрыть монтирование/пересборку до onReady).
  useEffect(() => { setSceneReady(false) }, [shotIndex])

  // countdown: на пустоте, со звуком (полная громкость); музыка вступает на «go» (в конце), сразу в полную.
  useEffect(() => {
    if (!clips || shot?.type !== 'countdown') return   // ждём загрузки клипов, чтобы звук совпал с оверлеем
    const tick = () => sfxRef.current.play2D('count_tick', COUNTDOWN_SFX_GAIN)
    setCountdownN(3); tick()
    const per = shot.durationMs / 3
    const t1 = setTimeout(() => { setCountdownN(2); tick() }, per)
    const t2 = setTimeout(() => { setCountdownN(1); tick() }, per * 2)
    const t3 = setTimeout(() => {
      sfxRef.current.play2D('go', COUNTDOWN_SFX_GAIN)
      // Музыка стартует ПОСЛЕ отсчёта (на «go»), не во время него.
      if (!musicStarted.current) {
        musicStarted.current = true
        void music.start().then(() => music.setVolume(masterRef.current)).catch(() => { /* без музыки */ })
      }
      advance()
    }, shot.durationMs)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shotIndex, clips])

  // перебивка (cut): держим на экране durationMs (анимация in/out внутри), затем переход.
  // Звук «go» проигрывается заранее на лид-сигнале предыдущего play-шота (см. onSceneNearEnd).
  useEffect(() => {
    if (shot?.type !== 'text') return
    const t = setTimeout(advance, shot.durationMs)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shotIndex])

  // finale: титул всплывает, когда лучи замерли; страховочный выход (FinaleScene сам зовёт onEnd).
  // На заморозке лучей глушим музыку через fadeOut — затухающее эхо звенит хвостом под титулом
  // (тот же приём, что в конце матча: трек не обрывается резко).
  useEffect(() => {
    if (shot?.type !== 'finale') { setShowTitle(false); return }
    const tTitle = setTimeout(() => { setShowTitle(true); music.stop() }, 3600)
    const tEnd = setTimeout(finish, 9000)   // fallback на случай, если FinaleScene не дойдёт до onEnd
    return () => { clearTimeout(tTitle); clearTimeout(tEnd) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shotIndex])

  if (!clips || !shot) return <div className="trailer-root" />

  return (
    <div className="trailer-root">
      {/* countdown — на пустоте (карты нет): Canvas не рендерим, только оверлей отсчёта */}
      {shot.type === 'play' && (
        <>
          <ShotView key={`shot-${shotIndex}`} shot={shot} demo={clips[shot.clip]} onHud={setHud} onSfx={playSfx} onAnnounce={onAnnounce} onReady={onSceneReady} onNearEnd={onSceneNearEnd} onEnd={advance} />
          {/* Ковер: скрывает чёрный кадр монтирования/пересборки, плавно уходит на onReady */}
          <div className={`trailer-cover${sceneReady ? ' is-hidden' : ''}`} />
        </>
      )}

      {/* HUD реплея — только в play-шотах */}
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

      {/* Перебивка между кусками: киберпанк-текст (слэм-ин/глитч-аут), на пустоте */}
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
