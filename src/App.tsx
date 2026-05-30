import { useState, useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import { Game } from './Game'

export default function App() {
  const [locked, setLocked] = useState(false)
  const [beamProgress, setBeamProgress] = useState(1)
  const [shieldProgress, setShieldProgress] = useState(1)
  const [shieldVisible, setShieldVisible] = useState(false)

  useEffect(() => {
    const onChange = () => setLocked(!!document.pointerLockElement)
    document.addEventListener('pointerlockchange', onChange)
    return () => document.removeEventListener('pointerlockchange', onChange)
  }, [])

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <Canvas
        shadows
        camera={{ fov: 75, near: 0.1, far: 200, position: [0, 1.7, 5] }}
      >
        <Game
          setBeamProgress={setBeamProgress}
          setShieldProgress={setShieldProgress}
          setShieldVisible={setShieldVisible}
        />
      </Canvas>

      {/* HUD — всегда в screen-space, вне Canvas */}
      <div style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        color: 'white',
        fontSize: 22,
        lineHeight: 1,
        userSelect: 'none',
        pointerEvents: 'none',
        fontFamily: 'monospace',
        textShadow: '0 0 4px black',
        zIndex: 10,
      }}>
        +
      </div>

      {shieldVisible && (
        <div style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 200,
          height: 200,
          border: '3px solid rgba(65, 105, 225, 0.6)',
          borderRadius: '50%',
          pointerEvents: 'none',
          boxShadow: '0 0 20px rgba(65, 105, 225, 0.5)',
          zIndex: 10,
        }} />
      )}

      <div style={{
        position: 'fixed',
        bottom: 40,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        gap: 20,
        pointerEvents: 'none',
        fontFamily: 'monospace',
        zIndex: 10,
      }}>
        <div>
          <div style={{ color: '#0ff', fontSize: 11, marginBottom: 4, textAlign: 'center', letterSpacing: 1 }}>
            BEAM [ЛКМ]
          </div>
          <div style={{ width: 120, height: 6, background: '#222', borderRadius: 3 }}>
            <div style={{
              width: `${beamProgress * 100}%`,
              height: '100%',
              background: beamProgress === 1 ? '#0ff' : '#066',
              borderRadius: 3,
              transition: 'width 0.05s linear',
            }} />
          </div>
        </div>
        <div>
          <div style={{ color: '#6af', fontSize: 11, marginBottom: 4, textAlign: 'center', letterSpacing: 1 }}>
            SHIELD [ПКМ]
          </div>
          <div style={{ width: 120, height: 6, background: '#222', borderRadius: 3 }}>
            <div style={{
              width: `${shieldProgress * 100}%`,
              height: '100%',
              background: shieldProgress === 1 ? '#4169e1' : '#1a2a6e',
              borderRadius: 3,
              transition: 'width 0.05s linear',
            }} />
          </div>
        </div>
      </div>

      {!locked && (
        <div style={{
          position: 'fixed',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(0,0,0,0.75)',
          color: 'white',
          fontFamily: 'monospace',
          gap: 16,
          cursor: 'pointer',
          zIndex: 20,
        }}>
          <div style={{ fontSize: 32, letterSpacing: 4, fontWeight: 'bold' }}>ONESHOT</div>
          <div style={{ fontSize: 14, opacity: 0.7 }}>Click to play</div>
          <div style={{ fontSize: 12, opacity: 0.5, marginTop: 8, lineHeight: 1.8, textAlign: 'center' }}>
            WASD — move &nbsp;|&nbsp; Mouse — look<br />
            ЛКМ — beam &nbsp;|&nbsp; ПКМ — shield &nbsp;|&nbsp; Space — jump
          </div>
        </div>
      )}
    </div>
  )
}
