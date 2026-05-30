import { useRef } from 'react'
import { SHIELD_DURATION, SHIELD_COOLDOWN } from '../constants'

interface ShieldConfig {
  duration?: number
  cooldown?: number
  onActivate?: () => void
  onDeactivate?: () => void
}

export function useShieldSystem(config: ShieldConfig = {}) {
  const duration = config.duration ?? SHIELD_DURATION
  const cooldown = config.cooldown ?? SHIELD_COOLDOWN

  const shieldActive      = useRef(false)
  const shieldCooldown    = useRef(false)
  const shieldCooldownEnd = useRef(0)
  const durationTimer     = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cooldownTimer     = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Keep latest callbacks in a ref so timers always call the latest version
  const cbRef = useRef(config)
  cbRef.current = config

  const isActive = () => shieldActive.current

  const activate = () => {
    if (shieldCooldown.current || shieldActive.current) return
    if (!document.pointerLockElement) return

    shieldActive.current = true
    shieldCooldownEnd.current = Date.now() + duration + cooldown
    cbRef.current.onActivate?.()

    durationTimer.current = setTimeout(() => {
      durationTimer.current = null
      shieldActive.current = false
      shieldCooldown.current = true
      cbRef.current.onDeactivate?.()
    }, duration)

    cooldownTimer.current = setTimeout(() => {
      cooldownTimer.current = null
      shieldCooldown.current = false
    }, duration + cooldown)
  }

  const reset = () => {
    if (durationTimer.current) { clearTimeout(durationTimer.current); durationTimer.current = null }
    if (cooldownTimer.current) { clearTimeout(cooldownTimer.current); cooldownTimer.current = null }
    shieldActive.current = false
    shieldCooldown.current = false
    cbRef.current.onDeactivate?.()
  }

  const getProgress = (now: number): number => {
    const total = duration + cooldown
    return shieldActive.current || shieldCooldown.current
      ? Math.max(0, 1 - (shieldCooldownEnd.current - now) / total)
      : 1
  }

  return { isActive, activate, reset, getProgress }
}
