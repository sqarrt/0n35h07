import { useState, useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import { Game } from './Game'
import { useGameHUD } from './hooks/useGameHUD'
import { Crosshair } from './components/Crosshair'
import { ShieldBrackets } from './components/ShieldBrackets'
import { ScreenFlashes } from './components/ScreenFlashes'
import { WindupOverlay } from './components/WindupOverlay'
import { MainMenu } from './screens/MainMenu'
import { JoinLobby } from './screens/JoinLobby'
import { Lobby } from './screens/Lobby'
import { btn, dimBtn, screenOverlay } from './screens/styles'
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
  const { state: hud, dispatch } = useGameHUD()

  useEffect(() => {
    const onChange = () => {
      const isLocked = !!document.pointerLockElement
      setLocked(isLocked)
      if (isLocked) setEverLocked(true)
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
            <div
              style={{ position: 'fixed', inset: 0, zIndex: 10, cursor: 'crosshair', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              onClick={() => document.querySelector('canvas')?.requestPointerLock()}
            >
              <span style={{ color: 'rgba(255,255,255,0.25)', fontFamily: 'monospace', fontSize: '0.8rem', letterSpacing: '0.2em', userSelect: 'none' }}>
                НАЖМИТЕ ДЛЯ ВХОДА
              </span>
            </div>
          )}
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
        </>
      )}

      {paused && (
        <div style={{ ...screenOverlay, background: 'rgba(10,10,15,0.85)' }}>
          <h2 style={{ color: '#4af', letterSpacing: '0.2em', marginBottom: '2rem', marginTop: 0 }}>
            ПАУЗА
          </h2>
          <button style={btn} onClick={handleResume}>ПРОДОЛЖИТЬ</button>
          <button style={dimBtn} onClick={handleBack}>В МЕНЮ</button>
        </div>
      )}
    </div>
  )
}
