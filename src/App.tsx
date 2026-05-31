import { useState, useEffect } from 'react'
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
import { MainMenu } from './screens/MainMenu'
import { JoinLobby } from './screens/JoinLobby'
import { Lobby } from './screens/Lobby'
import { btn, dimBtn, screenOverlay } from './screens/styles'
import { POINTERLOCK_COOLDOWN } from './constants'
import type { BotDifficulty } from './constants'

type Screen = 'menu' | 'join' | 'lobby' | 'game'

function randomCode() {
  return Math.random().toString(36).slice(2, 6).toUpperCase()
}

function saveLobby(code: string, difficulties: BotDifficulty[]) {
  localStorage.setItem(`lobby_${code}`, JSON.stringify(difficulties))
}

function loadLobby(code: string): BotDifficulty[] | null {
  const raw = localStorage.getItem(`lobby_${code}`)
  return raw ? JSON.parse(raw) : null
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('menu')
  const [locked, setLocked] = useState(false)
  const [everLocked, setEverLocked] = useState(false)
  const [botDifficulties, setBotDifficulties] = useState<BotDifficulty[]>([])
  const [lobbyCode, setLobbyCode] = useState('')
  const [scoreboardOpen, setScoreboardOpen] = useState(false)
  const [lockReadyAt, setLockReadyAt] = useState(0)   // когда снова можно requestPointerLock (кулдаун Chrome)
  const [now, setNow] = useState(0)                   // тик для обратного отсчёта в паузе
  const { state: hud, dispatch } = useGameHUD()

  useEffect(() => {
    const onChange = () => {
      const isLocked = !!document.pointerLockElement
      setLocked(isLocked)
      if (isLocked) setEverLocked(true)
      else setLockReadyAt(Date.now() + POINTERLOCK_COOLDOWN)   // вышли из лока → старт кулдауна
    }
    document.addEventListener('pointerlockchange', onChange)
    return () => document.removeEventListener('pointerlockchange', onChange)
  }, [])

  // Hash-based routing
  useEffect(() => {
    const handleHash = () => {
      const code = window.location.hash.slice(1).toUpperCase()
      if (/^[A-Z0-9]{4}$/.test(code)) {
        const saved = loadLobby(code) ?? []
        setLobbyCode(code)
        setBotDifficulties(saved)
        setScreen('lobby')
      } else if (!code) {
        setScreen('menu')
      }
    }
    handleHash()
    window.addEventListener('hashchange', handleHash)
    return () => window.removeEventListener('hashchange', handleHash)
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
    saveLobby(code, [])
    setLobbyCode(code)
    setBotDifficulties([])
    setScreen('lobby')
    window.location.hash = code
  }

  const handleJoinLobby = () => setScreen('join')

  const handleJoin = (code: string) => {
    const difficulties = loadLobby(code) ?? []
    saveLobby(code, difficulties)
    setLobbyCode(code)
    setBotDifficulties(difficulties)
    setScreen('lobby')
    window.location.hash = code
  }

  const handleStart = () => {
    setEverLocked(false)
    setScreen('game')
  }

  const handleBack = () => {
    setScreen('menu')
    if (window.location.hash) window.location.hash = ''
  }

  const handleResume = () => {
    document.querySelector('canvas')?.requestPointerLock()
  }

  const handleBotAdd = () => {
    setBotDifficulties(prev => {
      if (prev.length >= 4) return prev
      const next: BotDifficulty[] = [...prev, 'normal']
      saveLobby(lobbyCode, next)
      return next
    })
  }

  const handleBotRemove = (idx: number) => {
    setBotDifficulties(prev => {
      const next = prev.filter((_, i) => i !== idx)
      saveLobby(lobbyCode, next)
      return next
    })
  }

  const handleDifficultyChange = (idx: number, d: BotDifficulty) => {
    setBotDifficulties(prev => {
      const next = prev.map((v, i) => i === idx ? d : v)
      saveLobby(lobbyCode, next)
      return next
    })
  }

  const paused = screen === 'game' && !locked && everLocked
  const lockCooldownLeft = Math.max(0, lockReadyAt - now)   // мс до возможности повторного входа
  const resumeDisabled = lockCooldownLeft > 0

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      {screen === 'menu' && <MainMenu onCreateLobby={handleCreateLobby} onJoinLobby={handleJoinLobby} />}
      {screen === 'join' && <JoinLobby onJoin={handleJoin} onBack={handleBack} />}
      {screen === 'lobby' && (
        <Lobby
          lobbyCode={lobbyCode}
          botDifficulties={botDifficulties}
          onBotAdd={handleBotAdd}
          onBotRemove={handleBotRemove}
          onDifficultyChange={handleDifficultyChange}
          onStart={handleStart}
          onBack={handleBack}
        />
      )}

      {screen === 'game' && (
        <>
          <Canvas shadows camera={{ fov: 75, near: 0.1, far: 200, position: [0, 1.7, 5] }}>
            <Game dispatch={dispatch} botDifficulties={botDifficulties} />
          </Canvas>
          {!locked && !everLocked && (
            <div style={{ position: 'fixed', inset: 0, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <button style={btn} onClick={() => document.querySelector('canvas')?.requestPointerLock()}>
                ГОТОВ?
              </button>
            </div>
          )}
          {/* HUD виден только когда играешь (указатель захвачен) — не в меню/на входе. */}
          {locked && (
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
