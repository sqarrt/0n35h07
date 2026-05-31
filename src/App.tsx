import { useState, useEffect, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { Game } from './Game'
import { useGameHUD } from './hooks/useGameHUD'
import { Crosshair } from './components/Crosshair'
import { ShieldBrackets } from './components/ShieldBrackets'
import { ScreenFlashes } from './components/ScreenFlashes'
import { WindupOverlay } from './components/WindupOverlay'
import { DashIndicator } from './components/DashIndicator'
import { Scoreboard } from './components/Scoreboard'
import { KillFeed } from './components/KillFeed'
import { ReadyOverlay } from './components/ReadyOverlay'
import { CountdownOverlay } from './components/CountdownOverlay'
import type { GameApi } from './Game'
import { MainMenu } from './screens/MainMenu'
import { JoinLobby } from './screens/JoinLobby'
import { Lobby } from './screens/Lobby'
import { Settings } from './screens/Settings'
import { loadProfile } from './settings'
import type { PlayerProfile } from './settings'
import { btn, dimBtn, screenOverlay } from './screens/styles'
import { POINTERLOCK_COOLDOWN } from './constants'
import type { BotDifficulty } from './constants'
import { createNet } from './net/createNet'
import { LobbySession } from './net/LobbySession'
import type { LobbyView, LobbyRole } from './net/LobbySession'
import type { INet, PeerId } from './net/INet'
import type { RosterEntry } from './net/protocol'
import type { MatchRole } from './constants'

type Screen = 'menu' | 'join' | 'lobby' | 'game' | 'settings'

interface GameNet {
  role: MatchRole
  net: INet
  netConfig: { localId: number; roster: RosterEntry[] }
  peerToPlayer: Map<PeerId, number>
}

function randomCode() {
  return Math.random().toString(36).slice(2, 6).toUpperCase()
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('menu')
  const [locked, setLocked] = useState(false)
  const [everLocked, setEverLocked] = useState(false)
  const [lobbyCode, setLobbyCode] = useState('')
  const [lobbyView, setLobbyView] = useState<LobbyView | null>(null)
  const [gameNet, setGameNet] = useState<GameNet | null>(null)
  const [scoreboardOpen, setScoreboardOpen] = useState(false)
  const [profile, setProfile] = useState<PlayerProfile>(() => loadProfile())
  const [lockReadyAt, setLockReadyAt] = useState(0)   // когда снова можно requestPointerLock (кулдаун Chrome)
  const [now, setNow] = useState(0)                   // тик для обратного отсчёта в паузе
  const { state: hud, dispatch } = useGameHUD()

  const sessionRef = useRef<LobbySession | null>(null)
  const gameApiRef = useRef<GameApi | null>(null)

  const leaveLobby = () => {
    sessionRef.current?.dispose()
    sessionRef.current = null
    setLobbyView(null)
    setGameNet(null)
  }

  const enterLobby = (code: string, role: LobbyRole) => {
    if (sessionRef.current) leaveLobby()
    const net = createNet(code)
    const session = new LobbySession(net, role, code, loadProfile())
    session.onChange(v => setLobbyView(v))
    session.onStart(() => {
      const matchRole: MatchRole = session.role === 'host' ? 'host' : 'client'
      setGameNet({ role: matchRole, net, netConfig: session.netConfig(), peerToPlayer: session.hostPeerToPlayer() })
      setEverLocked(false)
      setScreen('game')
    })
    sessionRef.current = session
    setLobbyCode(code)
    setScreen('lobby')
  }

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
        if (sessionRef.current?.code !== code) enterLobby(code, 'client')
      } else if (!code && !sessionRef.current) {
        setScreen('menu')
      }
    }
    handleHash()
    window.addEventListener('hashchange', handleHash)
    return () => window.removeEventListener('hashchange', handleHash)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Tab (зажат) → таблица счёта K/D.
  useEffect(() => {
    if (screen !== 'game') { setScoreboardOpen(false); return }
    const down = (e: KeyboardEvent) => { if (e.code === 'Tab') { e.preventDefault(); setScoreboardOpen(true) } }
    const up   = (e: KeyboardEvent) => { if (e.code === 'Tab') { e.preventDefault(); setScoreboardOpen(false) } }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up) }
  }, [screen])

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
    window.location.hash = code
    enterLobby(code, 'host')
  }
  const handleJoinLobby = () => setScreen('join')
  const handleJoin = (code: string) => { window.location.hash = code; enterLobby(code, 'client') }
  const handleSettings = () => setScreen('settings')

  const handleStart = () => sessionRef.current?.start()

  const handleBack = () => {
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
  const handleRemoveBot = (id: number) => sessionRef.current?.removeBot(id)
  const handleSetDifficulty = (id: number, d: BotDifficulty) => sessionRef.current?.setBotDifficulty(id, d)

  const paused = screen === 'game' && !locked && everLocked && hud.matchPhase === 'live'
  const lockCooldownLeft = Math.max(0, lockReadyAt - now)
  const resumeDisabled = lockCooldownLeft > 0

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      {screen === 'menu' && <MainMenu onCreateLobby={handleCreateLobby} onJoinLobby={handleJoinLobby} onSettings={handleSettings} />}
      {screen === 'join' && <JoinLobby onJoin={handleJoin} onBack={handleBack} />}
      {screen === 'settings' && (
        <Settings profile={profile} onChange={setProfile} onBack={() => setScreen('menu')} />
      )}
      {screen === 'lobby' && lobbyView && (
        <Lobby
          lobbyCode={lobbyCode}
          view={lobbyView}
          onAddBot={handleAddBot}
          onRemoveBot={handleRemoveBot}
          onSetDifficulty={handleSetDifficulty}
          onStart={handleStart}
          onBack={handleBack}
        />
      )}

      {screen === 'game' && gameNet && (
        <>
          <Canvas shadows camera={{ fov: 75, near: 0.1, far: 200, position: [0, 1.7, 5] }}>
            <Game
              dispatch={dispatch}
              role={gameNet.role}
              net={gameNet.net}
              netConfig={gameNet.netConfig}
              peerToPlayer={gameNet.peerToPlayer}
              apiRef={gameApiRef}
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
              <button style={btn} onClick={() => document.querySelector('canvas')?.requestPointerLock()}>
                ГОТОВ?
              </button>
            </div>
          )}
          {locked && hud.matchPhase !== 'ready' && (
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
              <KillFeed lastKill={hud.lastKill} />
              <Scoreboard scores={hud.scores} visible={scoreboardOpen} />
            </>
          )}
        </>
      )}

      {paused && (
        <div style={{ ...screenOverlay, background: 'rgba(10,10,15,0.85)' }}>
          <h2 style={{ color: '#4af', letterSpacing: '0.2em', marginBottom: '2rem', marginTop: 0 }}>
            МЕНЮ
          </h2>
          <button
            style={{
              ...btn,
              position: 'relative', overflow: 'hidden',
              opacity: resumeDisabled ? 0.5 : 1,
              cursor: resumeDisabled ? 'default' : 'pointer',
            }}
            disabled={resumeDisabled}
            onClick={handleResume}
          >
            {resumeDisabled ? `ПРОДОЛЖИТЬ (${(lockCooldownLeft / 1000).toFixed(1)}с)` : 'ПРОДОЛЖИТЬ'}
            {resumeDisabled && (
              <span style={{
                position: 'absolute', left: 0, bottom: 0, height: 2, background: '#4af',
                width: `${(1 - lockCooldownLeft / POINTERLOCK_COOLDOWN) * 100}%`,
              }} />
            )}
          </button>
          <button style={dimBtn} onClick={handleBack}>В МЕНЮ</button>
        </div>
      )}
    </div>
  )
}
