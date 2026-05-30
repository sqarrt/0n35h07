import { useRef, useEffect } from 'react'

interface GameKeys {
  forward: boolean
  back: boolean
  left: boolean
  right: boolean
}

export function useGameInput() {
  const keys = useRef<GameKeys>({ forward: false, back: false, left: false, right: false })

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'KeyW') keys.current.forward = true
      if (e.code === 'KeyS') keys.current.back    = true
      if (e.code === 'KeyA') keys.current.left    = true
      if (e.code === 'KeyD') keys.current.right   = true
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'KeyW') keys.current.forward = false
      if (e.code === 'KeyS') keys.current.back    = false
      if (e.code === 'KeyA') keys.current.left    = false
      if (e.code === 'KeyD') keys.current.right   = false
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
