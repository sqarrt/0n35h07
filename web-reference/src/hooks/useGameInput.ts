import { useRef, useEffect } from 'react'

interface GameKeys {
  forward: boolean
  back: boolean
  left: boolean
  right: boolean
  jump: boolean   // held jump state (auto-bhop while held; edge = double jump) — handled per frame
}

export function useGameInput() {
  const keys = useRef<GameKeys>({ forward: false, back: false, left: false, right: false, jump: false })

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'KeyW') keys.current.forward = true
      if (e.code === 'KeyS') keys.current.back    = true
      if (e.code === 'KeyA') keys.current.left    = true
      if (e.code === 'KeyD') keys.current.right   = true
      // Jump is held (not OS keydown auto-repeat, otherwise W+D+Space breaks bhop). preventDefault avoids page scroll.
      if (e.code === 'Space') { e.preventDefault(); keys.current.jump = true }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'KeyW') keys.current.forward = false
      if (e.code === 'KeyS') keys.current.back    = false
      if (e.code === 'KeyA') keys.current.left    = false
      if (e.code === 'KeyD') keys.current.right   = false
      if (e.code === 'Space') keys.current.jump   = false
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup',   onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup',   onKeyUp)
    }
  }, [])

  return keys
}
