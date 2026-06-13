import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { StreakTier } from '../game/streak'

type FxKind = StreakTier | 'catalyst'

const SCRAMBLE = '#@%&$/\\|<>*+='
const SCRAMBLE_MS = 240
const SCRAMBLE_FLASH_MS = 90
const SCRAMBLE_CHANCE = 0.4

interface EffectTextProps {
  text: string
  kind: FxKind | null      // null → обычный текст без эффекта
  color: string            // цвет игрока (--pc)
  testid?: string
  dataStreak?: string      // значение data-streak (для e2e на нике)
}

/** SVG-фильтры электричества — один раз на дерево (нужны для filter:url(#ks-elN)). */
export function EffectDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      <filter id="ks-el1"><feTurbulence type="fractalNoise" baseFrequency="0 0.9" numOctaves="2" seed="7" result="n"><animate attributeName="baseFrequency" dur="3s" values="0 0.9;0 0.55;0 0.9" repeatCount="indefinite"/></feTurbulence><feDisplacementMap in="SourceGraphic" in2="n" scale="3"/></filter>
      <filter id="ks-el2"><feTurbulence type="fractalNoise" baseFrequency="0.02 0.8" numOctaves="2" seed="3" result="n"><animate attributeName="baseFrequency" dur="1.4s" values="0.02 0.8;0.03 0.4;0.02 0.8" repeatCount="indefinite"/></feTurbulence><feDisplacementMap in="SourceGraphic" in2="n" scale="5"/></filter>
      <filter id="ks-el3"><feTurbulence type="fractalNoise" baseFrequency="0.03 0.7" numOctaves="3" seed="11" result="n"><animate attributeName="baseFrequency" dur="0.8s" values="0.03 0.7;0.06 0.3;0.03 0.7" repeatCount="indefinite"/></feTurbulence><feDisplacementMap in="SourceGraphic" in2="n" scale="8"/></filter>
    </svg>
  )
}

export function EffectText({ text, kind, color, testid, dataStreak }: EffectTextProps) {
  const [shown, setShown] = useState(text)
  const baseRef = useRef(text)
  baseRef.current = text

  // SINGULARITY: порча символов на миг (моноширинно-безопасные ASCII) и щелчок назад.
  useEffect(() => {
    setShown(text)
    if (kind !== 'singularity') return
    const id = setInterval(() => {
      const base = baseRef.current
      const g = base.split('').map(c => (/[A-Za-z0-9]/.test(c) && Math.random() < SCRAMBLE_CHANCE)
        ? SCRAMBLE[Math.floor(Math.random() * SCRAMBLE.length)] : c).join('')
      setShown(g)
      setTimeout(() => setShown(baseRef.current), SCRAMBLE_FLASH_MS)
    }, SCRAMBLE_MS)
    return () => clearInterval(id)
  }, [kind, text])

  if (!kind) {
    return <div className="nm" data-testid={testid}>{text}</div>
  }

  const style = { '--pc': color } as CSSProperties
  // .nm даёт единую HUD-типографику (вне .match-hud класс .nm безвреден); .fx — только оформление.
  const cls = `nm fx fx--${kind}`
  const isCatalyst = kind === 'catalyst'

  return (
    <div className={cls} style={style} data-testid={testid} data-streak={dataStreak}>
      {shown}
      {/* хром-сплит «разрыв сигнала» для тиров (не для catalyst) */}
      {!isCatalyst && <><span className="glitch-a" aria-hidden="true">{shown}</span><span className="glitch-b" aria-hidden="true">{shown}</span></>}
      {/* искры/дуги: тиры — пара, catalyst — плотный крекинг (SURGE без бегущего тока) */}
      <i className="arc" style={ARC[0]} /><i className="arc" style={ARC[1]} /><i className="arc" style={ARC[2]} />
      {isCatalyst && <><i className="arc" style={ARC[3]} /><i className="arc" style={ARC[4]} /><i className="tick" style={TICK[0]} /><i className="tick" style={TICK[1]} /><i className="tick" style={TICK[2]} /></>}
    </div>
  )
}

// Раскладка искр/щелчков (из firstblood-catalyst-final.html). Анимации навешиваем инлайном (разные тайминги).
const ARC: CSSProperties[] = [
  { top: '20%', left: -12, width: 20, transform: 'rotate(20deg)', animation: 'ks-crack .5s infinite 0s' },
  { top: '80%', right: -12, width: 20, transform: 'rotate(-18deg)', animation: 'ks-crack .45s infinite .12s' },
  { top: '8%', right: '20%', width: 14, transform: 'rotate(36deg)', animation: 'ks-crack .55s infinite .22s' },
  { top: '55%', left: -14, width: 16, transform: 'rotate(-10deg)', animation: 'ks-crack .4s infinite .3s' },
  { top: '35%', right: -12, width: 18, transform: 'rotate(12deg)', animation: 'ks-crack .5s infinite .38s' },
]
const TICK: CSSProperties[] = [
  { top: '64%', left: '14%', animation: 'ks-tick .5s infinite .05s' },
  { top: '14%', left: '40%', animation: 'ks-tick .6s infinite .25s' },
  { top: '70%', left: '70%', animation: 'ks-tick .55s infinite .15s' },
]
