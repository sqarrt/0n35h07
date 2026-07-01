import { useState, type CSSProperties, type MouseEvent as ReactMouse } from 'react'

// Shared "window" chrome for the desktop radio panels (the library explorer + the code panel): a draggable,
// resizable, maximizable floating frame. Keeps the geometry (x/y/w/h), the maximized flag, and a `live` flag that
// suspends the CSS transition while dragging/resizing (else the frame lags the cursor). One source of truth so both
// panels behave identically.
export interface WindowGeo { x: number; y: number; w: number; h: number }

export interface WindowChrome {
  geo: WindowGeo
  maxed: boolean
  live: boolean            // true while dragging/resizing → callers drop the geometry transition
  toggleMax: () => void
  startGeo: (e: ReactMouse, mode: 'move' | 'resize') => void
  /** left/top/width/height for the frame — full-screen (minus an 8px margin) when maximized, else the geometry. */
  frameStyle: CSSProperties
}

export function useWindowChrome(initial: WindowGeo, min: { w: number; h: number }): WindowChrome {
  const [geo, setGeo] = useState<WindowGeo>(initial)
  const [maxed, setMaxed] = useState(false)
  const [live, setLive] = useState(false)

  const startGeo = (e: ReactMouse, mode: 'move' | 'resize') => {
    if (maxed) return // no drag/resize while maximized
    e.preventDefault(); setLive(true)
    const sx = e.clientX, sy = e.clientY, g0 = { ...geo }
    const onMove = (ev: globalThis.MouseEvent) => {
      const dx = ev.clientX - sx, dy = ev.clientY - sy
      if (mode === 'move') setGeo({ ...g0, x: g0.x + dx, y: g0.y + dy })
      else setGeo({ ...g0, w: Math.max(min.w, g0.w + dx), h: Math.max(min.h, g0.h + dy) })
    }
    const onUp = () => { setLive(false); document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
    document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp)
  }

  const frameStyle: CSSProperties = maxed
    ? { left: 8, top: 8, width: 'calc(100vw - 16px)', height: 'calc(100vh - 16px)' }
    : { left: geo.x, top: geo.y, width: geo.w, height: geo.h }

  return { geo, maxed, live, toggleMax: () => setMaxed((m) => !m), startGeo, frameStyle }
}
