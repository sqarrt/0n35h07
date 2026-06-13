import { useState, useEffect, useRef, useCallback, lazy, memo, Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { Game } from './Game'
import { useGameHUD } from './hooks/useGameHUD'
import type { HUDAction } from './hooks/useGameHUD'
import type { ISfxEngine } from './game/audio/sfx/types'
import { Crosshair } from './components/Crosshair'
import { ShieldBrackets } from './components/ShieldBrackets'
import { ScreenFlashes } from './components/ScreenFlashes'
import { WindupOverlay } from './components/WindupOverlay'
import { DashIndicator } from './components/DashIndicator'
import { StatsOverlay } from './components/StatsOverlay'
import { RespawnOverlay } from './components/RespawnOverlay'
import { MatchHud } from './components/MatchHud'
import { StreakBanner } from './components/StreakBanner'
import { EffectDefs } from './components/EffectText'
import { OverheatVignette } from './components/OverheatVignette'
import { ReadyOverlay } from './components/ReadyOverlay'
import { CountdownOverlay } from './components/CountdownOverlay'
import { MatchEndedOverlay } from './components/MatchEndedOverlay'
import { PauseMenu } from './components/PauseMenu'
import { MenuBackdrop } from './components/MenuBackdrop'
import { MapBackground } from './components/MapBackground'
import { NetStatusChip } from './components/NetStatusChip'
import { VersionChip } from './components/VersionChip'
import { EpilepsyWarning } from './components/EpilepsyWarning'
import { MainMenu } from './screens/MainMenu'
import { Lobby } from './screens/Lobby'
import type { LobbySlot } from './screens/Lobby'
import type { GameApi } from './Game'
import { Settings } from './screens/Settings'
import { Appearance } from './screens/Appearance'
import type { AppearancePart } from './components/menuStage'
import { loadProfile, saveProfile } from './settings'
import type { PlayerProfile, SearchRole } from './settings'
import { I18nProvider, detectLocale, useT } from './i18n'
import { ThreeSfxEngine } from './game/audio/sfx/ThreeSfxEngine'
import { SfxProvider } from './sfx/SfxContext'
import { WebAudioMusicEngine } from './game/audio/WebAudioMusicEngine'
import { MenuMusic } from './game/audio/MenuMusic'
import { AudioAnalysis } from './game/audio/AudioAnalysis'
import { AudioBar } from './components/AudioBar'
import { POINTERLOCK_COOLDOWN } from './constants'
import { IS_ELECTRON } from './platform'
import type { BallModel, WindupStyle, RespawnStyle, DashStyle, ShieldStyle } from './constants'
import { createNet, resolveNetKind } from './net/createNet'
import { warmMapPreviews, MAP_IDS } from './game/maps'
import { warmRelayCache } from './net/relays'
import { warmTrystero } from './net/TrysteroNet'
import { useDampedTranslateX } from './hooks/useDampedTranslateX'
import { useDelayedUnmount } from './hooks/useDelayedUnmount'
import { RoomSession } from './net/RoomSession'
import type { RoomView, RoomRole } from './net/RoomSession'
import type { INet, PeerId } from './net/INet'
import type { RosterEntry } from './net/protocol'
import type { MatchRole, MapId, MapFilter, DurationFilter, BotDifficulty } from './constants'
import { DEFAULT_MAP_ID, HOST_ID, OPPONENT_ID, MATCH_DURATIONS_MIN } from './constants'
import { createMatchmakingPool } from './net/createMatchmakingPool'
import type { MatchmakingPool } from './net/matchmaking'
import { DualMatchmaker } from './net/DualMatchmaker'

type Screen = 'menu' | 'lobby' | 'game' | 'settings' | 'appearance'

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

// Конфиг камеры — модульная константа: инлайновый объект пересоздавался бы на каждом рендере.
const GAME_CAMERA = { fov: 75, near: 0.1, far: 200, position: [0, 1.7, 5] as [number, number, number] }

interface GameCanvasProps {
  dispatch: (action: HUDAction) => void
  gameNet: GameNet
  reserveColor: string
  defaultThirdPerson: boolean
  apiRef: React.MutableRefObject<GameApi | null>
  sfxEngine: ISfxEngine
  musicVolume: number
  audioAnalysis: AudioAnalysis
}

// HUD-экшены (прогресс заряда, скорость, таймер) ре-рендерят App десятки раз в секунду — Canvas НЕЛЬЗЯ
// ре-рендерить вместе с ним. Configure-эффект r3f (без deps) на каждом рендере Canvas перезаписывает size
// в r3f-сторе: rect из useMeasure (8 ключей) сравнивается со state.size (4 ключа), и is.equ в r3f 9 ВСЕГДА
// видит «изменение». Каждый новый size будит всех подписчиков useThree (весь Game-поддерево), а ре-рендер
// MapEdges заставляет EffectComposer пересобирать EffectPass с шейдерами каждый кадр — шторм аллокаций
// (~18 МБ/с) и многосекундные паузы Major GC. memo + стабильные пропсы отсекают каскад в корне.
// (Тот же класс граблей, что и memo у Game — см. комментарий в Game.tsx.)
const GameCanvas = memo(function GameCanvas({ dispatch, gameNet, reserveColor, defaultThirdPerson, apiRef, sfxEngine, musicVolume, audioAnalysis }: GameCanvasProps) {
  return (
    /* shadows="percentage" → PCFShadowMap напрямую (PCFSoftShadowMap в three 0.184 deprecated и
       всё равно откатывается к PCF) — тот же результат без deprecation-варнинга. */
    <Canvas shadows="percentage" camera={GAME_CAMERA}>
      <Game
        dispatch={dispatch}
        role={gameNet.role}
        net={gameNet.net}
        netConfig={gameNet.netConfig}
        peerToPlayer={gameNet.peerToPlayer}
        reserveColor={reserveColor}
        defaultThirdPerson={defaultThirdPerson}
        apiRef={apiRef}
        durationMs={gameNet.durationMs}
        mapId={gameNet.mapId}
        seedCode={gameNet.code}
        sfxEngine={sfxEngine}
        musicVolume={musicVolume}
        audioAnalysis={audioAnalysis}
      />
    </Canvas>
  )
})

// Персистентность роли хоста. `HOSTED_KEY` (localStorage) — последний СОЗДАННЫЙ нами код (переживает закрытие
// вкладки/перезапуск браузера). `HOST_LIVE_KEY` — код, который вкладка-хост держит ПРЯМО СЕЙЧАС (снимается на
// unload). Решение при открытии #CODE: хост, если код наш И живого хоста этого кода нет (мы — та самая вкладка
// после refresh/повторного открытия); иначе клиент. Так refresh/reopen хоста → снова хост, а ВТОРАЯ вкладка
// при живой первой (или вход по чужому коду) → клиент. На другом устройстве localStorage не общий → клиент.
const HOSTED_KEY = 'oneshot:hosted'
const HOST_LIVE_KEY = 'oneshot:hostLive'
function forgetHosted() { try { localStorage.removeItem(HOSTED_KEY); localStorage.removeItem(HOST_LIVE_KEY) } catch { /* ignore */ } }
function setHostLive(code: string) { try { localStorage.setItem(HOST_LIVE_KEY, code) } catch { /* ignore */ } }
function clearHostLive(code: string) { try { if (localStorage.getItem(HOST_LIVE_KEY) === code) localStorage.removeItem(HOST_LIVE_KEY) } catch { /* ignore */ } }

/** Fallback Suspense для ленивого редактора — под I18nProvider, отсюда useT. */
function EditorLoading() {
  const t = useT()
  return <div style={{ color: 'var(--accent)', fontFamily: 'var(--ui-font)', padding: 20 }}>{t.editorLoading}</div>
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('menu')
  const [editorMode, setEditorMode] = useState(() => import.meta.env.DEV && isEditorHash())
  const [locked, setLocked] = useState(false)
  const [roomCode, setRoomCode] = useState('')
  const [roomView, setRoomView] = useState<RoomView | null>(null)
  const [gameNet, setGameNet] = useState<GameNet | null>(null)
  const [profile, setProfile] = useState<PlayerProfile>(() => loadProfile())
  // initial читается провайдером один раз — не пересчитываем на каждом рендере (lazy-init, без чтения ref в рендере)
  const [initialLocale] = useState(() => profile.locale ?? detectLocale())
  const [appearancePreview, setAppearancePreview] = useState<{ color: string; model: BallModel; ringColor: string; windupStyle: WindupStyle; windupSeq: number; respawnStyle: RespawnStyle; respawnSeq: number; dashStyle: DashStyle; dashSeq: number; shieldStyle: ShieldStyle; shieldSeq: number; part: AppearancePart; ballArt: string | undefined }>(() => ({ color: profile.primaryColor, model: profile.ballModel, ringColor: profile.reserveColor, windupStyle: profile.windupStyle, windupSeq: 0, respawnStyle: profile.respawnStyle, respawnSeq: 0, dashStyle: profile.dashStyle, dashSeq: 0, shieldStyle: profile.shieldStyle, shieldSeq: 0, part: 'color', ballArt: profile.ballArt }))
  // Счётчики кликов превью (windupSeq/respawnSeq/dashSeq/shieldSeq) сохраняются из прежнего стейта: ими
  // владеет App (монотонные, переживают перемонтирование «Внешности» — иначе призрачный запуск при повторном заходе).
  const handlePreview = useCallback((color: string, model: BallModel, ringColor: string, windupStyle: WindupStyle, respawnStyle: RespawnStyle, dashStyle: DashStyle, shieldStyle: ShieldStyle, part: AppearancePart, ballArt: string | undefined) => setAppearancePreview(p => ({ ...p, color, model, ringColor, windupStyle, respawnStyle, dashStyle, shieldStyle, part, ballArt })), [])
  // Стиль + счётчик обновляются ОДНИМ setState: промежуточный рендер «новый seq, старый стиль»
  // запускал превью старого стиля и тут же гасил его пересозданием эффекта (баг переключения).
  const handleShotPreview = useCallback((windupStyle: WindupStyle) => setAppearancePreview(p => ({ ...p, windupStyle, windupSeq: p.windupSeq + 1 })), [])
  // Ракурс камеры стоит как поставлен (никаких авто-возвратов) — меняется только следующим кликом.
  const handleRespawnPreview = useCallback((respawnStyle: RespawnStyle) => setAppearancePreview(p => ({ ...p, respawnStyle, respawnSeq: p.respawnSeq + 1, part: 'respawn' })), [])
  const handleDashPreview = useCallback((dashStyle: DashStyle) => setAppearancePreview(p => ({ ...p, dashStyle, dashSeq: p.dashSeq + 1, part: 'dash' })), [])
  const handleShieldPreview = useCallback((shieldStyle: ShieldStyle) => setAppearancePreview(p => ({ ...p, shieldStyle, shieldSeq: p.shieldSeq + 1, part: 'shield' })), [])
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
    // предупреждением, до того как игрок его закроет → первое «Создать комнату» открывается мгновенно.
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

  const [lobbyMode, setLobbyMode] = useState<SearchRole>('both')
  const [searching, setSearching] = useState(false)
  const [draftSel, setDraftSel] = useState<{ map: MapFilter; durationMin: DurationFilter }>({ map: [MAP_IDS[0]], durationMin: [MATCH_DURATIONS_MIN[0]] })
  const poolRef = useRef<MatchmakingPool | null>(null)
  const dmRef = useRef<DualMatchmaker | null>(null)
  const lobbyCodeRef = useRef<string>('')   // код хоста на сессию лобби (стабилен при переключении ролей)

  const sessionRef = useRef<RoomSession | null>(null)
  const gameApiRef = useRef<GameApi | null>(null)

  const leaveRoom = () => {
    sessionRef.current?.dispose()
    sessionRef.current = null
    setRoomView(null)
    setGameNet(null)
  }

  const enterRoom = (code: string, role: RoomRole, sel?: { map: MapFilter; durationMin: DurationFilter }) => {
    if (sessionRef.current) leaveRoom()
    if (role === 'host') setHostLive(code)   // помечаем эту вкладку живым хостом кода (снимется на unload)
    const net = createNet(code)
    const session = new RoomSession(net, role, code, loadProfile(), sel)
    session.onChange(v => setRoomView(v))
    session.onStart((durationMs, mapId) => {
      const matchRole: MatchRole = session.role === 'host' ? 'host' : 'client'
      // Сброс результата/времени/счёта прошлого матча — иначе старый экран исхода мелькнёт поверх нового матча.
      dispatch({ type: 'RESET_MATCH' })
      // Матч стартует с ритуала готовности — заранее ставим фазу 'ready', иначе на миг мелькает оверлей паузы.
      dispatch({ type: 'SET_MATCH_PHASE', phase: 'ready', ready: [], countdown: 0 })
      // Копия карты: чистка ростера в RoomSession.onPeerLeave не должна стирать маршрутизацию игры.
      setGameNet({ role: matchRole, net, netConfig: session.netConfig(), peerToPlayer: new Map(session.hostPeerToPlayer()), durationMs, mapId, code })
      setScreen('game')
    })
    // Клиент: хост ушёл из лобби / хендшейк не сложился → откат в idle согласно режиму.
    session.onClosed(() => {
      setSearching(false)
      dmRef.current?.stop(); dmRef.current = null
      if (lobbyMode !== 'client') enterRoom(lobbyCodeRef.current, 'host', draftSel)   // both/host: снова поднять host-сессию
      else leaveRoom()
    })
    sessionRef.current = session
    setRoomCode(code)
  }

  // На входе в меню прогреваем кеш живых релеев (self-healing сигналинга). Только для интернет-транспорта:
  // под ?net=bc (e2e/локалка) реальные WebSocket-пробы не нужны и шумят в тестах.
  useEffect(() => {
    if (screen === 'menu' && resolveNetKind() === 'trystero') void warmRelayCache()
  }, [screen])

  // Прогрев превью карт на старте: к открытию комнаты картинки уже в HTTP-кэше (см. warmMapPreviews).
  useEffect(() => { warmMapPreviews() }, [])

  // Случайные F5/Ctrl+W в live-матче не должны молча убивать бой — браузер спросит подтверждение.
  // В Electron гард не ставим: там beforeunload без диалога просто блокирует закрытие окна.
  useEffect(() => {
    if (IS_ELECTRON || screen !== 'game' || hud.matchPhase !== 'live') return
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [screen, hud.matchPhase])

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
      if (!isLocked) setLockReadyAt(Date.now() + POINTERLOCK_COOLDOWN)
    }
    document.addEventListener('pointerlockchange', onChange)
    return () => document.removeEventListener('pointerlockchange', onChange)
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

  // Пока открыта пауза — тикаем для обратного отсчёта кулдауна pointer lock.
  useEffect(() => {
    const isPaused = screen === 'game' && !locked && hud.matchPhase === 'live'
    if (!isPaused) return
    setNow(Date.now())
    const iv = setInterval(() => setNow(Date.now()), 100)
    return () => clearInterval(iv)
  }, [screen, locked, hud.matchPhase])

  // Соперник появился: host/both — входящий занял слот (фиксируем host в матчмейкере); client — пришёл ASSIGN.
  useEffect(() => {
    if (!searching || !roomView) return
    if (roomView.isHost && roomView.roster.length > 1) { dmRef.current?.hostConnected(); setSearching(false) }
    if (!roomView.isHost && roomView.connected) setSearching(false)
  }, [searching, roomView])

  const handleSettings = () => setScreen('settings')
  const handleAppearance = () => setScreen('appearance')
  // Выход из игры: в Electron закрывает окно (→ приложение завершается), в браузере — вкладку.
  const handleExit = () => window.close()
  const handleResume = () => { document.querySelector('canvas')?.requestPointerLock() }
  // Готовность в матче — клик ловит pointer lock (нужен жест) и отмечает игрока готовым (host↔client синк).
  const handleReady = () => {
    document.querySelector('canvas')?.requestPointerLock()
    gameApiRef.current?.requestReady()
  }

  const disposePool = () => { poolRef.current?.dispose(); poolRef.current = null }

  // ИГРАТЬ → лобби. Режим из профиля (дефолт both). both/host сразу поднимают host-сессию (виден код+слот);
  // client — черновик без сети до ПОИСКа/ввода кода хоста.
  const handlePlay = () => {
    disposePool()
    poolRef.current = createMatchmakingPool()
    const mode: SearchRole = profile.searchRole
    const sel: { map: MapFilter; durationMin: DurationFilter } = { map: [MAP_IDS[0]], durationMin: [MATCH_DURATIONS_MIN[0]] }
    setDraftSel(sel)
    setSearching(false)
    setLobbyMode(mode)
    lobbyCodeRef.current = randomCode()   // фиксируем код лобби (не меняется при переключении ролей)
    if (mode !== 'client') enterRoom(lobbyCodeRef.current, 'host', sel)
    else leaveRoom()   // клиент-черновик: без сессии до поиска/ввода кода
    setScreen('lobby')
  }

  const handleBack = () => {
    setSearching(false)
    dmRef.current?.stop(); dmRef.current = null
    disposePool()
    forgetHosted()   // явный выход в меню → больше не претендуем на роль хоста этого кода
    leaveRoom()
    setScreen('menu')
  }

  // --- колбэки лобби ---
  const onLobbySetMap = (m: MapFilter) => { if (sessionRef.current) sessionRef.current.setMap(m); else setDraftSel(s => ({ ...s, map: m })) }
  const onLobbySetDuration = (d: DurationFilter) => { if (sessionRef.current) sessionRef.current.setDuration(d); else setDraftSel(s => ({ ...s, durationMin: d })) }
  const onLobbyAddBot = (d: BotDifficulty = 'normal') => sessionRef.current?.addBot(d)
  const onLobbyRemoveBot = () => sessionRef.current?.removeBot()
  const onLobbySetBotDifficulty = (d: BotDifficulty) => sessionRef.current?.setBotDifficulty(d)
  const onLobbyReady = () => sessionRef.current?.setLocalReady(true)
  const onLobbyEnterCode = (code: string) => { setSearching(true); dmRef.current?.stop(); dmRef.current = null; poolRef.current?.cancel(); enterRoom(code, 'client', draftSel) }

  // Смена режима (only idle: RolePicker disabled при сопернике в слоте).
  const onLobbySetRole = (mode: SearchRole) => {
    if (mode === lobbyMode) return
    const sel = roomView ? { map: roomView.mapSel, durationMin: roomView.durationSel } : draftSel
    setSearching(false)
    dmRef.current?.stop(); dmRef.current = null
    poolRef.current?.withdraw(); poolRef.current?.cancel()
    setDraftSel(sel)
    setLobbyMode(mode)
    if (mode !== 'client') enterRoom(lobbyCodeRef.current, 'host', sel)   // both/host: host-сессия
    else leaveRoom()   // client: черновик
  }

  const onLobbySearch = () => {
    const pool = poolRef.current
    if (!pool) return
    setSearching(true)
    const curMap = roomView?.mapSel ?? draftSel.map
    const curDur = roomView?.durationSel ?? draftSel.durationMin
    const dm = new DualMatchmaker({
      pool, mode: lobbyMode, code: lobbyCodeRef.current,
      listing: { code: lobbyCodeRef.current, name: profile.name, color: profile.primaryColor, map: curMap, durationMin: curDur },
      filter: { map: curMap, durationMin: curDur },
    })
    dm.onJoin(code => { setSearching(false); enterRoom(code, 'client', draftSel) })
    dmRef.current = dm
    dm.start()
  }
  const onLobbyStopSearch = () => { setSearching(false); dmRef.current?.stop(); dmRef.current = null; poolRef.current?.withdraw(); poolRef.current?.cancel() }

  // Любой live без захвата мыши — пауза (в т.ч. если первый pointer lock не удался: раньше этот
  // кейс закрывала отдельная live-кнопка «ГОТОВ?», теперь путь один — оверлей с «ПРОДОЛЖИТЬ»).
  const paused = screen === 'game' && !locked && hud.matchPhase === 'live'
  const lockCooldownLeft = Math.max(0, lockReadyAt - now)
  const resumeDisabled = lockCooldownLeft > 0

  // На экране «войти в комнату» показываем резервный цвет (хост может занять твой основной — превью того,
  // как ты, скорее всего, будешь выглядеть). Переход цвета плавный (лерп в MenuBackdrop).
  const menuPlayer = screen === 'appearance'
    ? appearancePreview
    : { color: profile.primaryColor, model: profile.ballModel, ringColor: profile.reserveColor, windupStyle: profile.windupStyle, respawnStyle: profile.respawnStyle, dashStyle: profile.dashStyle, shieldStyle: profile.shieldStyle, ballArt: profile.ballArt }

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

  // Размытый фон карты — только в комнате, с fade in/out. Держим смонтированным на время выхода-фейда;
  // последний mapId фиксируем, чтобы при выходе (roomView уже null) фон не мигнул на дефолтную карту.
  const showMap = screen === 'lobby'
  const mapMounted = useDelayedUnmount(showMap, MAP_FADE_MS)
  const [lastMapId, setLastMapId] = useState<MapId>(DEFAULT_MAP_ID)
  useEffect(() => {
    const m = roomView?.mapId ?? draftSel.map[0]
    if (m) setLastMapId(m)
  }, [roomView?.mapId, draftSel.map])

  // Пропсы лобби: нормализуем RoomView (или черновик клиента без сессии) в форму Lobby.
  const buildLobby = () => {
    const v = roomView
    const isHost = v ? v.isHost : lobbyMode !== 'client'   // both/host визуально как хост (код+слот); client — черновик
    let me: LobbySlot = { name: profile.name, color: profile.primaryColor, ready: false }
    let opponent: (LobbySlot & { isBot: boolean }) | null = null
    if (v) {
      const myId = isHost ? HOST_ID : OPPONENT_ID
      const oppId = isHost ? OPPONENT_ID : HOST_ID
      const meE = v.roster.find(r => r.id === myId)
      if (meE) me = { name: meE.name, color: meE.color, ready: v.ready.includes(myId) }
      // клиент видит хоста ТОЛЬКО после подключения (ASSIGN), иначе его собственная заглушка-host выглядит как «матч с собой»
      const oppE = (isHost || v.connected) ? v.roster.find(r => r.id === oppId) : undefined
      opponent = oppE ? { name: oppE.name, color: oppE.color, ready: v.ready.includes(oppId), isBot: oppE.kind === 'bot' } : null
    }
    return {
      isHost, me, opponent,
      mapSel: v?.mapSel ?? draftSel.map,
      durationSel: v?.durationSel ?? draftSel.durationMin,
      code: isHost ? roomCode : null,
      searching,
      mode: lobbyMode, onSetRole: onLobbySetRole,
      onAddBot: onLobbyAddBot, onRemoveBot: onLobbyRemoveBot, onSetBotDifficulty: onLobbySetBotDifficulty, onEnterCode: onLobbyEnterCode,
      onSetMap: onLobbySetMap, onSetDuration: onLobbySetDuration,
      onSearch: onLobbySearch, onStopSearch: onLobbyStopSearch, onReady: onLobbyReady,
      onBack: handleBack,
    }
  }
  const lobbyProps = screen === 'lobby' ? buildLobby() : null

  if (editorMode) {
    // Редактор без UI смены языка — onChange не нужен
    return (
      <I18nProvider initial={initialLocale}>
        <Suspense fallback={<EditorLoading />}><EditorRoot /></Suspense>
      </I18nProvider>
    )
  }

  return (
    <I18nProvider
      initial={initialLocale}
      onChange={id => setProfile(p => {
        const next = { ...p, locale: id }
        saveProfile(next)
        return next
      })}
    >
    <SfxProvider engine={sfx}>
    <div style={{ width: '100vw', height: '100vh', position: 'relative', background: 'var(--bg)' }}>
      {screen !== 'game' && mapMounted && <MapBackground mapId={lastMapId} show={showMap} />}
      {/* Свечение контуров глушится muted'ом БЕЗ размонтирования композера (мгновенно в обе стороны):
          на «Внешности» — всегда, в остальных меню — по настройке «Свечение в меню». */}
      {/* part только на экране «Внешность»: иначе ретенция (напр. shot/paint) держит разворот шара в меню. */}
      {screen !== 'game' && <MenuBackdrop mode={screen} player={menuPlayer} room={roomView} appearancePart={screen === 'appearance' ? appearancePreview.part : 'color'} analysis={profile.menuGlow ? audioAnalysis : undefined} glowMuted={screen === 'appearance' || !profile.menuGlow} onReady={handleMenuReady} sfx={sfx} />}
      {screen !== 'game' && resolveNetKind() === 'trystero' && <NetStatusChip />}
      {screen !== 'game' && <VersionChip />}
      {/* Единая персистентная подложка: едет (не пересоздаётся) при смене экрана; внутри — контент экрана. */}
      {screen !== 'game' && (
        <div className="screen">
          <div className="menu-panel" ref={panelRef}>
            {screen === 'menu' && <MainMenu onPlay={handlePlay} onAppearance={handleAppearance} onSettings={handleSettings} onExit={handleExit} />}
            {screen === 'settings' && (
              <Settings profile={profile} onChange={setProfile} onBack={() => setScreen('menu')} />
            )}
            {screen === 'appearance' && (
              <Appearance profile={profile} onChange={setProfile} onPreview={handlePreview} onShotPreview={handleShotPreview} onRespawnPreview={handleRespawnPreview} onDashPreview={handleDashPreview} onShieldPreview={handleShieldPreview} onBack={() => setScreen('menu')} />
            )}
            {screen === 'lobby' && lobbyProps && <Lobby {...lobbyProps} />}
          </div>
        </div>
      )}

      {screen === 'game' && gameNet && (
        <>
          <GameCanvas
            dispatch={dispatch}
            gameNet={gameNet}
            reserveColor={profile.reserveColor}
            defaultThirdPerson={profile.defaultView === 'tp'}
            apiRef={gameApiRef}
            sfxEngine={sfx}
            musicVolume={profile.volumeMaster * profile.volumeMusic}
            audioAnalysis={audioAnalysis}
          />
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
              <StreakBanner announce={hud.announce} />
              <OverheatVignette tier={hud.streaks[gameNet.netConfig.localId] ?? null} />
              <EffectDefs />
            </>
          )}
          {/* HUD-бар: в live (при захвате указателя) сверху, в конце матча трансформируется в центр (итоговый счёт). */}
          {((locked && hud.matchPhase === 'live') || hud.matchPhase === 'ended') && (
            <MatchHud scores={hud.scores} matchTime={hud.matchTime} roster={gameNet.netConfig.roster} localId={gameNet.netConfig.localId} streaks={hud.streaks} streakCounts={hud.streakCounts} ended={!!hud.matchResult} />
          )}
          {hud.matchResult && (
            <MatchEndedOverlay result={hud.matchResult} onExit={handleBack} />
          )}
        </>
      )}

      {paused && (
        <PauseMenu
          resumeDisabled={resumeDisabled}
          cooldownPct={(1 - lockCooldownLeft / POINTERLOCK_COOLDOWN) * 100}
          showExit={IS_ELECTRON}
          onResume={handleResume}
          onBack={handleBack}
          onExit={handleExit}
        />
      )}

      {showWarning && <EpilepsyWarning onDismiss={() => setShowWarning(false)} />}
    </div>
    </SfxProvider>
    </I18nProvider>
  )
}
