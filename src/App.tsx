import { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { Game } from './Game'
import { useGameHUD } from './hooks/useGameHUD'
import { Crosshair } from './components/Crosshair'
import { ShieldBrackets } from './components/ShieldBrackets'
import { ScreenFlashes } from './components/ScreenFlashes'
import { WindupOverlay } from './components/WindupOverlay'
import { DashIndicator } from './components/DashIndicator'
import { RespawnOverlay } from './components/RespawnOverlay'
import { MatchHud } from './components/MatchHud'
import { ReadyOverlay } from './components/ReadyOverlay'
import { CountdownOverlay } from './components/CountdownOverlay'
import { MatchEndedOverlay } from './components/MatchEndedOverlay'
import { MenuBackdrop } from './components/MenuBackdrop'
import { MapBackground } from './components/MapBackground'
import { NetStatusChip } from './components/NetStatusChip'
import type { GameApi } from './Game'
import { MainMenu } from './screens/MainMenu'
import { JoinLobby } from './screens/JoinLobby'
import type { JoinStatus } from './screens/JoinLobby'
import { Lobby } from './screens/Lobby'
import { Settings } from './screens/Settings'
import { loadProfile } from './settings'
import type { PlayerProfile } from './settings'
import { Button } from './ui/Button'
import { POINTERLOCK_COOLDOWN, CONNECT_TIMEOUT_MS } from './constants'
import type { BotDifficulty, BallModel } from './constants'
import { createNet, resolveNetKind } from './net/createNet'
import { warmRelayCache } from './net/relays'
import { useDampedTranslateX } from './hooks/useDampedTranslateX'
import { useDelayedUnmount } from './hooks/useDelayedUnmount'
import { LobbySession } from './net/LobbySession'
import type { LobbyView, LobbyRole } from './net/LobbySession'
import type { INet, PeerId } from './net/INet'
import type { RosterEntry } from './net/protocol'
import type { MatchRole, MapId } from './constants'
import { DEFAULT_MAP_ID } from './constants'

type Screen = 'menu' | 'join' | 'lobby' | 'game' | 'settings'

const SETTINGS_PANEL_SHIFT_FRAC = 0.18   // на сколько (доля ширины окна) подложка уезжает вправо в настройках

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
  const [settingsPreview, setSettingsPreview] = useState<{ color: string; model: BallModel }>(() => ({ color: profile.primaryColor, model: profile.ballModel }))
  const handlePreview = useCallback((color: string, model: BallModel) => setSettingsPreview({ color, model }), [])
  const [lockReadyAt, setLockReadyAt] = useState(0)   // когда снова можно requestPointerLock (кулдаун Chrome)
  const [now, setNow] = useState(0)                   // тик для обратного отсчёта в паузе
  const { state: hud, dispatch } = useGameHUD()

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
      setGameNet({ role: matchRole, net, netConfig: session.netConfig(), peerToPlayer: new Map(session.hostPeerToPlayer()), durationMs, mapId })
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
    }, CONNECT_TIMEOUT_MS)
  }
  const handleSettings = () => setScreen('settings')

  const handleStart = () => sessionRef.current?.start()

  const handleBack = () => {
    if (connectTimer.current) { clearTimeout(connectTimer.current); connectTimer.current = null }
    setJoinStatus('idle')
    forgetHosted()   // явный выход в меню → больше не претендуем на роль хоста этого кода
    leaveLobby()
    setScreen('menu')
    if (window.location.hash) window.location.hash = ''
  }

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
  const menuPlayer = screen === 'settings'
    ? settingsPreview
    : { color: screen === 'join' ? profile.reserveColor : profile.primaryColor, model: profile.ballModel }

  // Подложка едет вправо на экране настроек (освобождая слева место под модель) — демпфированно, в одном
  // темпе с фоновыми шарами (та же MENU_ANIM_TAU). Персистентна → переезд туда-обратно плавный.
  const panelSlide = screen === 'settings' ? Math.round(window.innerWidth * SETTINGS_PANEL_SHIFT_FRAC) : 0
  const panelRef = useDampedTranslateX(panelSlide)

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
    <div style={{ width: '100vw', height: '100vh', position: 'relative', background: 'var(--bg)' }}>
      {screen !== 'game' && mapMounted && <MapBackground mapId={lastMapId} show={showMap} />}
      {screen !== 'game' && <MenuBackdrop mode={screen} player={menuPlayer} lobby={lobbyView} />}
      {screen !== 'game' && resolveNetKind() === 'trystero' && <NetStatusChip />}
      {/* Единая персистентная подложка: едет (не пересоздаётся) при смене экрана; внутри — контент экрана. */}
      {screen !== 'game' && (
        <div className="screen">
          <div className="menu-panel" ref={panelRef}>
            {screen === 'menu' && <MainMenu onCreateLobby={handleCreateLobby} onJoinLobby={handleJoinLobby} onSettings={handleSettings} />}
            {screen === 'join' && <JoinLobby status={joinStatus} onJoin={handleJoin} onBack={handleBack} />}
            {screen === 'settings' && (
              <Settings profile={profile} onChange={setProfile} onPreview={handlePreview} onBack={() => setScreen('menu')} />
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
              defaultThirdPerson={profile.defaultView === 'tp'}
              apiRef={gameApiRef}
              durationMs={gameNet.durationMs}
              mapId={gameNet.mapId}
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
          {locked && (hud.matchPhase === 'live' || hud.matchPhase === 'countdown') && (
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
              {hud.respawning && <RespawnOverlay progress={hud.respawning.progress} />}
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
        </div>
      )}
    </div>
  )
}
