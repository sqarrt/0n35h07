import { useEffect, useRef } from 'react'

interface Keys {
  forward: boolean
  back: boolean
  left: boolean
  right: boolean
}

export function useGameInput() {
  const keys = useRef<Keys>({ forward: false, back: false, left: false, right: false })

  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (e.code === 'KeyW') keys.current.forward = true
      if (e.code === 'KeyS') keys.current.back = true
      if (e.code === 'KeyA') keys.current.left = true
      if (e.code === 'KeyD') keys.current.right = true
    }
    const onUp = (e: KeyboardEvent) => {
      if (e.code === 'KeyW') keys.current.forward = false
      if (e.code === 'KeyS') keys.current.back = false
      if (e.code === 'KeyA') keys.current.left = false
      if (e.code === 'KeyD') keys.current.right = false
    }
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
    }
  }, [])

  return keys
}
