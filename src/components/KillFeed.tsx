import { useEffect, useState } from 'react'
import type { KillEvent } from '../hooks/useGameHUD'

interface FeedItem extends KillEvent { t: number }

/** Лента убийств (как в CS): «убийца ⟶ жертва» в правом верхнем углу, гаснет через ~4с. */
export function KillFeed({ lastKill }: { lastKill: KillEvent | null }) {
  const [items, setItems] = useState<FeedItem[]>([])

  useEffect(() => {
    if (!lastKill) return
    setItems(prev => prev.some(k => k.id === lastKill.id) ? prev : [...prev, { ...lastKill, t: Date.now() }])
  }, [lastKill])

  useEffect(() => {
    const iv = setInterval(() => setItems(prev => prev.filter(k => Date.now() - k.t < 4000)), 500)
    return () => clearInterval(iv)
  }, [])

  return (
    <div style={{
      position: 'fixed', top: '7rem', right: '1rem', zIndex: 20, pointerEvents: 'none',
      display: 'flex', flexDirection: 'column', gap: '0.25rem', alignItems: 'flex-end',
      fontFamily: 'monospace', fontSize: '0.8rem',
    }}>
      {items.map(k => (
        <div key={k.id} style={{ background: 'rgba(10,10,15,0.7)', padding: '0.15rem 0.5rem' }}>
          <span style={{ color: '#4af' }}>{k.killer}</span>
          <span style={{ color: '#888', margin: '0 0.4rem' }}>⟶</span>
          <span style={{ color: '#f66' }}>{k.victim}</span>
        </div>
      ))}
    </div>
  )
}
