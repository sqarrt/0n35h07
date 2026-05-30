import { useState, useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import { Game } from './Game'
import { useGameHUD } from './hooks/useGameHUD'
import { Crosshair } from './components/Crosshair'
import { ShieldBrackets } from './components/ShieldBrackets'
import { ScreenFlashes } from './components/ScreenFlashes'
import { WindupOverlay } from './components/WindupOverlay'
import { MainMenu } from './screens/MainMenu'
import { CreateLobby, type BotDifficulty } from './screens/CreateLobby'
import { JoinLobby } from './screens/JoinLobby'
import { Lobby } from './screens/Lobby'
import { btn, dimBtn, screenOverlay } from './screens/styles'

type Screen = 'menu' | 'create' | 'join' | 'lobby' | 'game'

function randomCode() {
  return Math.random().toString(36).slice(2, 6).toUpperCase()
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('menu')
  const [locked, setLocked] = useState(false)
  const [everLocked, setEverLocked] = useState(false)
  const [botCount, setBotCount] = useState(1)
  const [botDifficulty, setBotDifficulty] = useState<BotDifficulty>('normal')
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

  const handleCreateLobby = () => {
    setLobbyCode(randomCode())
    setBotCount(1)
    setScreen('create')
  }

  const handleJoinLobby = () => setScreen('join')

  const handleJoin = (code: string) => {
    setLobbyCode(code)
    setBotCount(1)
    setScreen('lobby')
  }

  const handleStart = () => {
    setEverLocked(false)
    setScreen('game')
  }

  const handleBack = () => setScreen('menu')

  const handleResume = () => {
    document.querySelector('canvas')?.requestPointerLock()
  }

  const paused = screen === 'game' && !locked && everLocked

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      {screen === 'menu'   && <MainMenu onCreateLobby={handleCreateLobby} onJoinLobby={handleJoinLobby} />}
      {screen === 'create' && <CreateLobby lobbyCode={lobbyCode} botCount={botCount} botDifficulty={botDifficulty} onBotCountChange={setBotCount} onDifficultyChange={setBotDifficulty} onStart={handleStart} onBack={handleBack} />}
      {screen === 'join'   && <JoinLobby onJoin={handleJoin} onBack={handleBack} />}
      {screen === 'lobby'  && <Lobby lobbyCode={lobbyCode} botCount={botCount} onStart={handleStart} onBack={handleBack} />}

      {screen === 'game' && (
        <>
          <Canvas shadows camera={{ fov: 75, near: 0.1, far: 200, position: [0, 1.7, 5] }}>
            <Game dispatch={dispatch} botCount={botCount} botDifficulty={botDifficulty} />
          </Canvas>
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
