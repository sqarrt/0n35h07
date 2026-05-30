import { useState, useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import { Game } from './Game'

const TAU = 2 * Math.PI

export default function App() {
  const [locked, setLocked] = useState(false)
  const [beamProgress, setBeamProgress] = useState(1)
  const [shieldProgress, setShieldProgress] = useState(1)
  const [shieldVisible, setShieldVisible] = useState(false)
  const [beamFlash, setBeamFlash] = useState(false)

  useEffect(() => {
    const onChange = () => setLocked(!!document.pointerLockElement)
    document.addEventListener('pointerlockchange', onChange)
    return () => document.removeEventListener('pointerlockchange', onChange)
  }, [])

  const shieldColor   = shieldVisible ? '#6af' : (shieldProgress >= 1 ? '#4169e1' : '#1a2a6e')
  const shieldOpacity = shieldVisible ? 1 : (shieldProgress >= 1 ? 0.85 : 0.5)

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
          triggerBeamFlash={() => { setBeamFlash(true); setTimeout(() => setBeamFlash(false), 200) }}
        />
      </Canvas>

      {/* Прицел + beam cooldown ring */}
      <div style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'none', zIndex: 10,
      }}>
        <svg width="40" height="40" viewBox="0 0 40 40">
          <circle cx="20" cy="20" r="14" fill="none" stroke="#333" strokeWidth="2" opacity="0.6" />
          <circle
            cx="20" cy="20" r="14"
            fill="none"
            stroke={beamProgress >= 1 ? '#0ff' : '#066'}
            strokeWidth="2"
            strokeDasharray={`${TAU * 14}`}
            strokeDashoffset={`${TAU * 14 * (1 - beamProgress)}`}
            strokeLinecap="round"
            transform="rotate(-90 20 20)"
          />
          <text x="20" y="25" textAnchor="middle"
            fill="white" fontSize="16" fontFamily="monospace"
            style={{ filter: 'drop-shadow(0 0 2px black)', userSelect: 'none' }}>+</text>
        </svg>
      </div>

      {/* Виньетка + сетка при активном щите */}
      <div style={{
        position: 'fixed', inset: 0,
        boxShadow: shieldVisible ? 'inset 0 0 140px rgba(65,105,225,0.6)' : 'none',
        backgroundImage: shieldVisible
          ? 'linear-gradient(rgba(65,105,225,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(65,105,225,0.07) 1px, transparent 1px)'
          : 'none',
        backgroundSize: '40px 40px',
        transition: 'box-shadow 0.15s ease',
        pointerEvents: 'none', zIndex: 10,
      }} />

      {/* Угловые L-скобки — прогресс кулдауна щита */}
      {([
        { key: 'tl', pos: { top: 20, left: 20 },     path: 'M 3 55 L 3 3 L 55 3'   },
        { key: 'tr', pos: { top: 20, right: 20 },    path: 'M 57 55 L 57 3 L 5 3'  },
        { key: 'bl', pos: { bottom: 20, left: 20 },  path: 'M 3 5 L 3 57 L 55 57'  },
        { key: 'br', pos: { bottom: 20, right: 20 }, path: 'M 57 5 L 57 57 L 5 57' },
      ]).map(({ key, pos, path }) => (
        <div key={key} style={{ position: 'fixed', pointerEvents: 'none', zIndex: 11, ...pos }}>
          <svg width="60" height="60" viewBox="0 0 60 60">
            <path d={path} fill="none" stroke="#223" strokeWidth="6" opacity="0.4" />
            <path
              d={path}
              fill="none"
              stroke={shieldColor}
              strokeWidth="6"
              strokeDasharray="104"
              strokeDashoffset={`${104 * (1 - shieldProgress)}`}
              strokeLinecap="square"
              opacity={shieldOpacity}
              style={shieldVisible ? { filter: 'drop-shadow(0 0 6px #4169e1)' } : undefined}
            />
          </svg>
        </div>
      ))}

      {beamFlash && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,255,255,0.2)',
          pointerEvents: 'none', zIndex: 15,
        }} />
      )}

      {!locked && (
        <div style={{
          position: 'fixed', inset: 0,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.75)',
          color: 'white', fontFamily: 'monospace',
          gap: 16, cursor: 'pointer', zIndex: 20,
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
