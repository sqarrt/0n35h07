import { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { Game } from './Game'
import { useGameHUD } from './hooks/useGameHUD'
import { Crosshair } from './components/Crosshair'
import { ShieldBrackets } from './components/ShieldBrackets'
import { ScreenFlashes } from './components/ScreenFlashes'
import { WindupOverlay } from './components/WindupOverlay'
import { DashIndicator } from './components/DashIndicator'
import { StatsOverlay } from './components/StatsOverlay'
import { RespawnOverlay } from './components/RespawnOverlay'
import { MatchHud } from './components/MatchHud'
import { ReadyOverlay } from './components/ReadyOverlay'
import { CountdownOverlay } from './components/CountdownOverlay'
import { MatchEndedOverlay } from './components/MatchEndedOverlay'
import { MenuBackdrop } from './components/MenuBackdrop'
import { MapBackground } from './components/MapBackground'
import { NetStatusChip } from './components/NetStatusChip'
import { VersionChip } from './components/VersionChip'
import { EpilepsyWarning } from './components/EpilepsyWarning'
import type { GameApi } from './Game'
import { MainMenu } from './screens/MainMenu'
import { JoinLobby } from './screens/JoinLobby'
import type { JoinStatus } from './screens/JoinLobby'
import { Lobby } from './screens/Lobby'
import { Settings } from './screens/Settings'
import { Appearance } from './screens/Appearance'
import type { AppearancePart } from './components/menuStage'
import { loadProfile } from './settings'
import type { PlayerProfile } from './settings'
import { Button } from './ui/Button'
import { ThreeSfxEngine } from './game/audio/sfx/ThreeSfxEngine'
import { SfxProvider } from './sfx/SfxContext'
import { WebAudioMusicEngine } from './game/audio/WebAudioMusicEngine'
import { MenuMusic } from './game/audio/MenuMusic'
import { AudioAnalysis } from './game/audio/AudioAnalysis'
import { AudioBar } from './components/AudioBar'
import { POINTERLOCK_COOLDOWN } from './constants'
import { IS_ELECTRON } from './platform'
import type { BotDifficulty, BallModel, WindupStyle, RespawnStyle } from './constants'
import { createNet, resolveNetKind } from './net/createNet'
import { warmRelayCache } from './net/relays'
import { warmTrystero } from './net/TrysteroNet'
import { useDampedTranslateX } from './hooks/useDampedTranslateX'
import { useDelayedUnmount } from './hooks/useDelayedUnmount'
import { LobbySession } from './net/LobbySession'
import type { LobbyView, LobbyRole } from './net/LobbySession'
import type { INet, PeerId } from './net/INet'
import type { RosterEntry } from './net/protocol'
import type { MatchRole, MapId } from './constants'
import { DEFAULT_MAP_ID } from './constants'

type Screen = 'menu' | 'join' | 'lobby' | 'game' | 'settings' | 'appearance'

const APPEARANCE_PANEL_MARGIN_PX = 24   // отступ панели от правого края экрана на «Внешности»
// Прогрев Trystero запускаем не сразу по готовности canvas, а через паузу: даём ещё пару кадров отрисоваться,
// и только потом ловим синхронный фриз init (~860мс) — он проходит ЗА предупреждением, незаметно для игрока.
const TRYSTERO_WARM_DELAY_MS = 250

// Редактор карт — только в dev (npm run dev), в прод-сборку не попадает (ленивый чанк не грузится).
const EditorRoot = lazy(() => import('./editor/EditorRoot').then(m => ({ default: m.EditorRoot })))
const isEditorHash = () => window.location.hash.startsWith('#editor')
const MAP_FADE_MS = 700                  // длительность fade in/out фона карты (синхронно с .map-bg transition)

interface GameNet {
  role: MatchRole
  net: INet
  netConfig: { localId: number; roster: RosterEntry[] }
  peerToPlayer: Map<PeerId, number>
  durationMs: number
  mapId: MapId
  code: string
}

function randomCode() {
  return Math.random().toString(36).slice(2, 6).toUpperCase()
}

// Персистентность роли хоста. `HOSTED_KEY` (localStorage) — последний СОЗДАННЫЙ нами код (переживает закрытие
// вкладки/перезапуск браузера). `HOST_LIVE_KEY` — код, который вкладка-хост держит ПРЯМО СЕЙЧАС (снимается на
// unload). Решение при открытии #CODE: хост, если код наш И живого хоста этого кода нет (мы — та самая вкладка
// после refresh/повторного открытия); иначе клиент. Так refresh/reopen хоста → снова хост, а ВТОРАЯ вкладка
// при живой первой (или вход по чужому коду) → клиент. На другом устройстве localStorage не общий → клиент.
const HOSTED_KEY = 'oneshot:hosted'
const HOST_LIVE_KEY = 'oneshot:hostLive'
function rememberHosted(code: string) { try { localStorage.setItem(HOSTED_KEY, code) } catch { /* ignore */ } }
function forgetHosted() { try { localStorage.removeItem(HOSTED_KEY); localStorage.removeItem(HOST_LIVE_KEY) } catch { /* ignore */ } }
function setHostLive(code: string) { try { localStorage.setItem(HOST_LIVE_KEY, code) } catch { /* ignore */ } }
function clearHostLive(code: string) { try { if (localStorage.getItem(HOST_LIVE_KEY) === code) localStorage.removeItem(HOST_LIVE_KEY) } catch { /* ignore */ } }
/** Наш ли это код и нет живого хоста этого кода сейчас (refresh/reopen) → можем стать хостом. */
function shouldHost(code: string): boolean {
  try { return localStorage.getItem(HOSTED_KEY) === code && localStorage.getItem(HOST_LIVE_KEY) !== code }
  catch { return false }
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('menu')
  const [editorMode, setEditorMode] = useState(() => import.meta.env.DEV && isEditorHash())
  const [locked, setLocked] = useState(false)
  const [everLocked, setEverLocked] = useState(false)
  const [lobbyCode, setLobbyCode] = useState('')
  const [lobbyView, setLobbyView] = useState<LobbyView | null>(null)
  const [gameNet, setGameNet] = useState<GameNet | null>(null)
  const [profile, setProfile] = useState<PlayerProfile>(() => loadProfile())
  const [appearancePreview, setAppearancePreview] = useState<{ color: string; model: BallModel; ringColor: string; windupStyle: WindupStyle; windupSeq: number; respawnStyle: RespawnStyle; respawnSeq: number; part: AppearancePart }>(() => ({ color: profile.primaryColor, model: profile.ballModel, ringColor: profile.reserveColor, windupStyle: profile.windupStyle, windupSeq: 0, respawnStyle: profile.respawnStyle, respawnSeq: 0, part: 'color' }))
  // Счётчики кликов превью (windupSeq/respawnSeq) сохраняются из прежнего стейта: ими владеет App
  // (монотонные, переживают перемонтирование «Внешности» — иначе призрачный запуск при повторном заходе).
  const handlePreview = useCallback((color: string, model: BallModel, ringColor: string, windupStyle: WindupStyle, respawnStyle: RespawnStyle, part: AppearancePart) => setAppearancePreview(p => ({ ...p, color, model, ringColor, windupStyle, respawnStyle, part })), [])
  // Стиль + счётчик обновляются ОДНИМ setState: промежуточный рендер «новый seq, старый стиль»
  // запускал превью старого стиля и тут же гасил его пересозданием эффекта (баг переключения).
  const handleShotPreview = useCallback((windupStyle: WindupStyle) => setAppearancePreview(p => ({ ...p, windupStyle, windupSeq: p.windupSeq + 1 })), [])
  // Ракурс камеры стоит как поставлен (никаких авто-возвратов) — меняется только следующим кликом.
  const handleRespawnPreview = useCallback((respawnStyle: RespawnStyle) => setAppearancePreview(p => ({ ...p, respawnStyle, respawnSeq: p.respawnSeq + 1, part: 'respawn' })), [])
  const [lockReadyAt, setLockReadyAt] = useState(0)   // когда снова можно requestPointerLock (кулдаун Chrome)
  const [now, setNow] = useState(0)                   // тик для обратного отсчёта в паузе
  const { state: hud, dispatch } = useGameHUD()

  // Предупреждение о фоточувствительности — показываем с ПЕРВОГО рендера (чтобы не мелькнуло меню под ним).
  // Оно перекрывает прогрев menu-canvas, но это безопасно: вся тяжёлая работа (Trystero) отложена до готовности
  // canvas (handleMenuReady), а сам init WebGL-контекста лёгкий и проходит за предупреждением чисто. Под ?net=bc
  // (e2e/локальные 2 вкладки) предупреждение не показываем — иначе оверлей перехватывал бы клики в тестах.
  const [showWarning, setShowWarning] = useState(() => resolveNetKind() === 'trystero')
  const trysteroWarmedRef = useRef(false)
  const handleMenuReady = useCallback(() => {
    if (trysteroWarmedRef.current || resolveNetKind() !== 'trystero') return
    trysteroWarmedRef.current = true
    // Canvas прогрет → теперь безопасно ловить синхронный фриз init Trystero (~860мс): он пройдёт ЗА
    // предупреждением, до того как игрок его закроет → первое «Создать лобби» открывается мгновенно.
    setTimeout(() => warmTrystero(), TRYSTERO_WARM_DELAY_MS)
  }, [])

  // Единый SFX-движок на всё приложение (один AudioContext: меню + матч). Создаётся один раз (ленивый init).
  const [sfx] = useState(() => new ThreeSfxEngine())
  useEffect(() => { void sfx.load() }, [sfx])
  // Громкость эффектов = общий × эффекты (живьём: UI-звуки в меню сразу реагируют на ползунок).
  useEffect(() => { sfx.setMasterGain(profile.volumeMaster * profile.volumeSfx) }, [sfx, profile.volumeMaster, profile.volumeSfx])

  // Музыка меню (отдельный движок/контекст). Громкость = общий × музыка_меню (живьём).
  const [menuMusic] = useState(() => new MenuMusic(new WebAudioMusicEngine()))
  useEffect(() => { menuMusic.setVolume(profile.volumeMaster * profile.volumeMenuMusic) }, [menuMusic, profile.volumeMaster, profile.volumeMenuMusic])
  // Предзагрузка буферов заранее (декод не требует жеста) → первый жест запускает мгновенно, без второго действия.
  useEffect(() => { void menuMusic.preload() }, [menuMusic])

  // Анализ звука для визуализации: общий уровень со всех источников (SFX + музыка меню; музыку матча
  // регистрирует Game). Питает glow шаров в меню и полосу-визуализатор в матче.
  const [audioAnalysis] = useState(() => new AudioAnalysis())
  useEffect(() => {
    const offs = [
      audioAnalysis.addReader(() => sfx.readLevel()),
      audioAnalysis.addReader(() => menuMusic.readLevel()),
      audioAnalysis.addBandReader(out => sfx.readBands(out)),
      audioAnalysis.addBandReader(out => menuMusic.readBands(out)),
    ]
    return () => { for (const off of offs) off() }
  }, [audioAnalysis, sfx, menuMusic])
  // Играет на всех не-игровых экранах, гаснет в матче. В браузере первый старт — из пользовательского жеста
  // (autoplay-политика); в Electron autoplay разрешён (см. main.ts) → стартуем сразу, без жеста.
  const gesturedRef = useRef(IS_ELECTRON)
  useEffect(() => {
    if (screen === 'game') { menuMusic.stop(); return }
    if (gesturedRef.current) { void menuMusic.start(); return }
    const onGesture = () => {
      gesturedRef.current = true
      void menuMusic.start()
      window.removeEventListener('pointerdown', onGesture)
      window.removeEventListener('keydown', onGesture)
    }
    window.addEventListener('pointerdown', onGesture)
    window.addEventListener('keydown', onGesture)
    return () => { window.removeEventListener('pointerdown', onGesture); window.removeEventListener('keydown', onGesture) }
  }, [screen, menuMusic])

  const [joinStatus, setJoinStatus] = useState<JoinStatus>('idle')

  const sessionRef = useRef<LobbySession | null>(null)
  const gameApiRef = useRef<GameApi | null>(null)
  const connectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const leaveLobby = () => {
    sessionRef.current?.dispose()
    sessionRef.current = null
    setLobbyView(null)
    setGameNet(null)
  }

  const enterLobby = (code: string, role: LobbyRole) => {
    if (sessionRef.current) leaveLobby()
    if (role === 'host') setHostLive(code)   // помечаем эту вкладку живым хостом кода (снимется на unload)
    const net = createNet(code)
    const session = new LobbySession(net, role, code, loadProfile())
    session.onChange(v => setLobbyView(v))
    session.onStart((durationMs, mapId) => {
      const matchRole: MatchRole = session.role === 'host' ? 'host' : 'client'
      // Сброс результата/времени/счёта прошлого матча — иначе старый экран исхода мелькнёт поверх нового матча.
      dispatch({ type: 'RESET_MATCH' })
      // Матч всегда стартует с ритуала — заранее ставим фазу 'ready', иначе на миг мелькает live-кнопка «ГОТОВ?».
      dispatch({ type: 'SET_MATCH_PHASE', phase: 'ready', ready: [], countdown: 0 })
      // Копия карты: чистка ростера в LobbySession.onPeerLeave не должна стирать маршрутизацию игры.
      setGameNet({ role: matchRole, net, netConfig: session.netConfig(), peerToPlayer: new Map(session.hostPeerToPlayer()), durationMs, mapId, code })
      setEverLocked(false)
      setScreen('game')
    })
    sessionRef.current = session
    setLobbyCode(code)
  }

  // На входе в меню прогреваем кеш живых релеев (self-healing сигналинга). Только для интернет-транспорта:
  // под ?net=bc (e2e/локалка) реальные WebSocket-пробы не нужны и шумят в тестах.
  useEffect(() => {
    if (screen === 'menu' && resolveNetKind() === 'trystero') void warmRelayCache()
  }, [screen])


  // Дев-маршрут #editor → редактор карт (только при npm run dev).
  useEffect(() => {
    const onHash = () => setEditorMode(import.meta.env.DEV && isEditorHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  useEffect(() => {
    const onChange = () => {
      const isLocked = !!document.pointerLockElement
      setLocked(isLocked)
      if (isLocked) setEverLocked(true)
      else setLockReadyAt(Date.now() + POINTERLOCK_COOLDOWN)
    }
    document.addEventListener('pointerlockchange', onChange)
    return () => document.removeEventListener('pointerlockchange', onChange)
  }, [])

  // Hash-routing: /#CODE → войти в лобби клиентом (если ещё не в лобби с этим кодом).
  useEffect(() => {
    const handleHash = () => {
      const code = window.location.hash.slice(1).toUpperCase()
      if (/^[A-Z0-9]{4}$/.test(code)) {
        // Свой созданный код и нет живой вкладки-хоста (refresh/reopen) → хост; иначе (живой хост/чужой) → клиент.
        if (sessionRef.current?.code !== code) { enterLobby(code, shouldHost(code) ? 'host' : 'client'); setScreen('lobby') }
      } else if (!code && !sessionRef.current) {
        setScreen('menu')
      }
    }
    handleHash()
    window.addEventListener('hashchange', handleHash)
    return () => window.removeEventListener('hashchange', handleHash)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Матч завершён — освобождаем курсор для клика «ВЫЙТИ».
  useEffect(() => {
    if (hud.matchResult) document.exitPointerLock?.()
  }, [hud.matchResult])

  // Закрытие/обновление вкладки → мгновенный 'bye' соседу (иначе детект по presence-таймауту) + снимаем флаг
  // живого хоста этого кода (refresh/reopen этой же вкладки потом снова станет хостом; вторая живая — клиентом).
  useEffect(() => {
    const onUnload = () => {
      const s = sessionRef.current
      if (s?.role === 'host') clearHostLive(s.code)
      s?.net.leave()
    }
    window.addEventListener('beforeunload', onUnload)
    return () => window.removeEventListener('beforeunload', onUnload)
  }, [])

  // Экран входа: поиск → лобби найдено (транспорт нашёл пира) → подключён (получен ASSIGN) → в лобби.
  useEffect(() => {
    if (screen !== 'join') return
    const busy = joinStatus === 'searching' || joinStatus === 'found'
    if (!busy) return
    if (lobbyView?.connected) {
      if (connectTimer.current) { clearTimeout(connectTimer.current); connectTimer.current = null }
      setJoinStatus('idle')
      setScreen('lobby')
    } else if (joinStatus === 'searching' && lobbyView?.foundHost) {
      setJoinStatus('found')
    }
  }, [screen, joinStatus, lobbyView])

  // Размонтирование — чистка таймера подключения.
  useEffect(() => () => { if (connectTimer.current) clearTimeout(connectTimer.current) }, [])

  // Пока открыта пауза — тикаем для обратного отсчёта кулдауна pointer lock.
  useEffect(() => {
    const isPaused = screen === 'game' && !locked && everLocked
    if (!isPaused) return
    setNow(Date.now())
    const iv = setInterval(() => setNow(Date.now()), 100)
    return () => clearInterval(iv)
  }, [screen, locked, everLocked])

  const handleCreateLobby = () => {
    const code = randomCode()
    rememberHosted(code)   // запомнить, что это лобби создали мы → остаёмся хостом при обновлении
    window.location.hash = code
    enterLobby(code, 'host')
    setScreen('lobby')
  }
  const handleJoinLobby = () => { setScreen('join'); setJoinStatus('idle') }
  const handleJoin = (code: string) => {
    if (connectTimer.current) clearTimeout(connectTimer.current)
    setJoinStatus('searching')
    window.location.hash = code
    enterLobby(code, 'client')   // остаёмся на экране 'join'
    connectTimer.current = setTimeout(() => {
      // Классифицируем провал по свежему состоянию сессии: нашли пира, но не завершили хендшейк →
      // «не удалось подключиться»; пира так и не нашли → «лобби не найдено».
      const foundHost = sessionRef.current?.view().foundHost ?? false
      setJoinStatus(foundHost ? 'failed-connect' : 'failed-find')
      leaveLobby()               // гасим сессию (стоп HELLO-ретраи); код остаётся в инпуте для повтора
    }, profile.connectTimeoutSec * 1000)
  }
  const handleSettings = () => setScreen('settings')
  const handleAppearance = () => setScreen('appearance')

  const handleStart = () => sessionRef.current?.start()

  const handleBack = () => {
    if (connectTimer.current) { clearTimeout(connectTimer.current); connectTimer.current = null }
    setJoinStatus('idle')
    forgetHosted()   // явный выход в меню → больше не претендуем на роль хоста этого кода
    leaveLobby()
    setScreen('menu')
    if (window.location.hash) window.location.hash = ''
  }

  // Выход из игры: в Electron закрывает окно (→ приложение завершается), в браузере — вкладку.
  const handleExit = () => window.close()
  const handleResume = () => { document.querySelector('canvas')?.requestPointerLock() }
  const handleReady = () => {
    document.querySelector('canvas')?.requestPointerLock()
    gameApiRef.current?.requestReady()
  }

  const handleAddBot = () => sessionRef.current?.addBot('normal')
  const handleRemoveBot = () => sessionRef.current?.removeBot()
  const handleSetDifficulty = (d: BotDifficulty) => sessionRef.current?.setBotDifficulty(d)
  const handleSetDuration = (min: number) => sessionRef.current?.setDuration(min)
  const handleSetMap = (id: MapId) => sessionRef.current?.setMap(id)

  const paused = screen === 'game' && !locked && everLocked && hud.matchPhase === 'live'
  const lockCooldownLeft = Math.max(0, lockReadyAt - now)
  const resumeDisabled = lockCooldownLeft > 0

  // На экране «войти в лобби» показываем резервный цвет (хост может занять твой основной — превью того,
  // как ты, скорее всего, будешь выглядеть). Переход цвета плавный (лерп в MenuBackdrop).
  const menuPlayer = screen === 'appearance'
    ? appearancePreview
    // на «войти» показываем резервный (основной может занять хост) → кольцо в основной; иначе наоборот
    : screen === 'join'
      ? { color: profile.reserveColor, model: profile.ballModel, ringColor: profile.primaryColor, windupStyle: profile.windupStyle, respawnStyle: profile.respawnStyle }
      : { color: profile.primaryColor, model: profile.ballModel, ringColor: profile.reserveColor, windupStyle: profile.windupStyle, respawnStyle: profile.respawnStyle }

  // На «Внешности» панель прибита почти к правому краю (небольшой отступ) — всё остальное пространство
  // отдано шару-превью. Сдвиг считается из ИЗМЕРЕННОЙ ширины панели и пересчитывается ТОЛЬКО при смене
  // экрана/ресайзе (никакие ре-рендеры превью не двигают панель). Переезд — демпфер (MENU_ANIM_TAU).
  const [panelSlide, setPanelSlide] = useState(0)
  const panelRef = useDampedTranslateX(panelSlide)
  useEffect(() => {
    const compute = () => {
      if (screen !== 'appearance') { setPanelSlide(0); return }
      const w = panelRef.current?.offsetWidth ?? 0
      setPanelSlide(Math.max(0, Math.round((window.innerWidth - w) / 2 - APPEARANCE_PANEL_MARGIN_PX)))
    }
    compute()
    window.addEventListener('resize', compute)
    return () => window.removeEventListener('resize', compute)
  }, [screen, panelRef])

  // Размытый фон карты — только в лобби, с fade in/out. Держим смонтированным на время выхода-фейда;
  // последний mapId фиксируем, чтобы при выходе (lobbyView уже null) фон не мигнул на дефолтную карту.
  const showMap = screen === 'lobby' && !!lobbyView
  const mapMounted = useDelayedUnmount(showMap, MAP_FADE_MS)
  const [lastMapId, setLastMapId] = useState<MapId>(DEFAULT_MAP_ID)
  useEffect(() => { if (lobbyView?.mapId) setLastMapId(lobbyView.mapId) }, [lobbyView?.mapId])

  if (editorMode) {
    return <Suspense fallback={<div style={{ color: 'var(--accent)', fontFamily: 'var(--ui-font)', padding: 20 }}>Загрузка редактора…</div>}><EditorRoot /></Suspense>
  }

  return (
    <SfxProvider engine={sfx}>
    <div style={{ width: '100vw', height: '100vh', position: 'relative', background: 'var(--bg)' }}>
      {screen !== 'game' && mapMounted && <MapBackground mapId={lastMapId} show={showMap} />}
      {/* Свечение контуров глушится muted'ом БЕЗ размонтирования композера (мгновенно в обе стороны):
          на «Внешности» — всегда, в остальных меню — по настройке «Свечение в меню». */}
      {screen !== 'game' && <MenuBackdrop mode={screen} player={menuPlayer} lobby={lobbyView} appearancePart={appearancePreview.part} analysis={profile.menuGlow ? audioAnalysis : undefined} glowMuted={screen === 'appearance' || !profile.menuGlow} onReady={handleMenuReady} sfx={sfx} />}
      {screen !== 'game' && resolveNetKind() === 'trystero' && <NetStatusChip />}
      {screen !== 'game' && <VersionChip />}
      {/* Единая персистентная подложка: едет (не пересоздаётся) при смене экрана; внутри — контент экрана. */}
      {screen !== 'game' && (
        <div className="screen">
          <div className="menu-panel" ref={panelRef}>
            {screen === 'menu' && <MainMenu onCreateLobby={handleCreateLobby} onJoinLobby={handleJoinLobby} onAppearance={handleAppearance} onSettings={handleSettings} onExit={handleExit} />}
            {screen === 'join' && <JoinLobby status={joinStatus} onJoin={handleJoin} onBack={handleBack} />}
            {screen === 'settings' && (
              <Settings profile={profile} onChange={setProfile} onBack={() => setScreen('menu')} />
            )}
            {screen === 'appearance' && (
              <Appearance profile={profile} onChange={setProfile} onPreview={handlePreview} onShotPreview={handleShotPreview} onRespawnPreview={handleRespawnPreview} onBack={() => setScreen('menu')} />
            )}
            {screen === 'lobby' && lobbyView && (
              <Lobby
                lobbyCode={lobbyCode}
                view={lobbyView}
                onAddBot={handleAddBot}
                onRemoveBot={handleRemoveBot}
                onSetDifficulty={handleSetDifficulty}
                onSetDuration={handleSetDuration}
                onSetMap={handleSetMap}
                onStart={handleStart}
                onBack={handleBack}
              />
            )}
          </div>
        </div>
      )}

      {screen === 'game' && gameNet && (
        <>
          {/* shadows="percentage" → PCFShadowMap напрямую (PCFSoftShadowMap в three 0.184 deprecated и
              всё равно откатывается к PCF) — тот же результат без deprecation-варнинга. */}
          <Canvas shadows="percentage" camera={{ fov: 75, near: 0.1, far: 200, position: [0, 1.7, 5] }}>
            <Game
              dispatch={dispatch}
              role={gameNet.role}
              net={gameNet.net}
              netConfig={gameNet.netConfig}
              peerToPlayer={gameNet.peerToPlayer}
              reserveColor={profile.reserveColor}
              defaultThirdPerson={profile.defaultView === 'tp'}
              apiRef={gameApiRef}
              durationMs={gameNet.durationMs}
              mapId={gameNet.mapId}
              seedCode={gameNet.code}
              sfxEngine={sfx}
              musicVolume={profile.volumeMaster * profile.volumeMusic}
              audioAnalysis={audioAnalysis}
            />
          </Canvas>
          {hud.matchPhase === 'ready' && (
            <ReadyOverlay
              roster={gameNet.netConfig.roster}
              localId={gameNet.netConfig.localId}
              role={gameNet.role}
              ready={hud.ready}
              onReady={handleReady}
            />
          )}
          {hud.matchPhase === 'countdown' && <CountdownOverlay n={hud.countdown} />}
          {hud.matchPhase === 'live' && !locked && !everLocked && (
            <div style={{ position: 'fixed', inset: 0, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <button className="btn" onClick={() => document.querySelector('canvas')?.requestPointerLock()}>
                ГОТОВ?
              </button>
            </div>
          )}
          {/* Игровой HUD — только в live; во время отсчёта чистый экран (камеру крутить можно) + сам отсчёт. */}
          {locked && hud.matchPhase === 'live' && (
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
              <StatsOverlay showFps={profile.showFps} showSpeed={profile.showSpeed} speed={hud.playerSpeed} />
              {hud.respawning && <RespawnOverlay progress={hud.respawning.progress} />}
              {profile.audioViz && <AudioBar analysis={audioAnalysis} />}
              <MatchHud scores={hud.scores} matchTime={hud.matchTime} roster={gameNet.netConfig.roster} localId={gameNet.netConfig.localId} />
            </>
          )}
          {hud.matchResult && (
            <MatchEndedOverlay result={hud.matchResult} onExit={handleBack} />
          )}
        </>
      )}

      {paused && (
        <div className="screen" style={{ background: 'rgba(10,10,15,0.85)' }}>
          <h2 style={{ color: '#4af', letterSpacing: '0.2em', marginBottom: '2rem', marginTop: 0 }}>
            МЕНЮ
          </h2>
          <button
            className="btn btn--primary"
            style={{
              position: 'relative', overflow: 'hidden',
              opacity: resumeDisabled ? 0.5 : 1,
              cursor: resumeDisabled ? 'default' : 'pointer',
            }}
            disabled={resumeDisabled}
            onClick={handleResume}
          >
            {/* индикация кулдауна — заливка слева-направо (без смены текста → кнопка не прыгает) */}
            {resumeDisabled && (
              <span style={{
                position: 'absolute', left: 0, top: 0, bottom: 0,
                width: `${(1 - lockCooldownLeft / POINTERLOCK_COOLDOWN) * 100}%`,
                background: 'rgba(120,180,255,0.28)',
              }} />
            )}
            <span style={{ position: 'relative' }}>ПРОДОЛЖИТЬ</span>
          </button>
          <Button variant="ghost" onClick={handleBack}>В МЕНЮ</Button>
          {IS_ELECTRON && <Button variant="ghost" onClick={handleExit}>ВЫХОД</Button>}
        </div>
      )}

      {showWarning && <EpilepsyWarning onDismiss={() => setShowWarning(false)} />}
    </div>
    </SfxProvider>
  )
}
