import { useState, useEffect } from 'react'
import { useT } from '../i18n'

// Длительность fade-out при закрытии (синхронно с transition в .warn-screen). Размонтируем по её истечении.
const WARN_FADE_MS = 280
// Через сколько после показа появляется подсказка и разблокируется закрытие.
// За это время за оверлеем успевает прогреться всё тяжёлое (Trystero ~860мс + glow-контур шара).
const HINT_DELAY_MS = 1500

/**
 * Полноэкранное предупреждение о мерцании/вспышках (фоточувствительная эпилепсия). Показывается ОДИН раз
 * при запуске, с первого рендера (перекрывает прогрев menu-canvas, чтобы не мелькнуло меню). Тяжёлой работы
 * под ним нет (она отложена в App до готовности canvas) → init WebGL-контекста за оверлеем проходит чисто.
 * Закрытие — левым кликом, но только после HINT_DELAY_MS (за это время всё прогревается). Тяжёлых CSS-фильтров
 * нет (только opacity/анимации на compositor).
 */
export function EpilepsyWarning({ onDismiss }: { onDismiss: () => void }) {
  const t = useT()
  const [ready, setReady] = useState(false)   // прошло ли HINT_DELAY_MS → можно закрыть
  const [out, setOut] = useState(false)
  useEffect(() => {
    const timer = setTimeout(() => setReady(true), HINT_DELAY_MS)
    return () => clearTimeout(timer)
  }, [])

  const handleDismiss = () => {
    if (!ready || out) return   // до подсказки клик игнорируем (ждём прогрева)
    setOut(true)
    setTimeout(onDismiss, WARN_FADE_MS)
  }

  return (
    <div
      className={`warn-screen${out ? ' warn-screen--out' : ''}${ready ? ' warn-screen--ready' : ''}`}
      role="dialog" aria-modal="true" onClick={handleDismiss}
    >
      {/* Планета-с-кольцом (идентичность игры) — приглушённо «дышит» на фоне, без размытия. */}
      <svg className="warn-planet" width="560" height="560" viewBox="0 0 256 256" aria-hidden="true">
        <defs>
          <radialGradient id="warnSphere" cx="37%" cy="31%" r="76%">
            <stop offset="0%" stopColor="#e8f7ff" />
            <stop offset="28%" stopColor="#73c9ff" />
            <stop offset="70%" stopColor="#2a8fe0" />
            <stop offset="100%" stopColor="#093c6f" />
          </radialGradient>
        </defs>
        <g transform="rotate(-20 128 128)">
          <path d="M40 128 A88 29 0 0 1 216 128" fill="none" stroke="#1c66a4" strokeWidth="9" strokeLinecap="round" />
        </g>
        <circle cx="128" cy="128" r="60" fill="url(#warnSphere)" />
        <ellipse cx="108" cy="104" rx="19" ry="12" fill="#fff" opacity="0.45" />
        <g transform="rotate(-20 128 128)">
          <path d="M216 128 A88 29 0 0 1 40 128" fill="none" stroke="#a6e3ff" strokeWidth="10" strokeLinecap="round" />
        </g>
      </svg>

      <div className="warn-content">
        <div className="warn-box">
          <div className="warn-head"><span className="warn-icon">⚠</span> {t.warnTitle}</div>
          <div className="warn-text">{t.warnBody}</div>
        </div>
        {/* Подсказка появляется через HINT_DELAY_MS. Место под неё зарезервировано (opacity, не mount) → не прыгает. */}
        <div className={`warn-hint${ready ? ' warn-hint--show' : ''}`}>
          <span className="warn-chip">{t.warnContinueKey}</span>
          <span>{t.warnContinueHint}</span>
        </div>
      </div>
    </div>
  )
}
