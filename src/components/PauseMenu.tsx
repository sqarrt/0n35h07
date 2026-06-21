import { Button } from '../ui/Button'
import { useT } from '../i18n'

interface PauseMenuProps {
  resumeDisabled: boolean
  cooldownPct: number     // 0..100 — cooldown fill width (left-to-right)
  showExit: boolean       // EXIT button on desktop only
  onResume: () => void
  onBack: () => void
  onExit: () => void
}

/** Pause menu (Esc): resume / to menu / exit. Lives under I18nProvider — hence useT. */
export function PauseMenu({ resumeDisabled, cooldownPct, showExit, onResume, onBack, onExit }: PauseMenuProps) {
  const t = useT()
  return (
    <div className="screen" style={{ background: 'rgba(10,10,15,0.85)' }}>
      <h2 style={{ color: '#4af', letterSpacing: '0.2em', marginBottom: '2rem', marginTop: 0 }}>
        {t.pauseTitle}
      </h2>
      <button
        className="btn btn--primary"
        data-testid="pause-resume"
        style={{
          position: 'relative', overflow: 'hidden',
          opacity: resumeDisabled ? 0.5 : 1,
          cursor: resumeDisabled ? 'default' : 'pointer',
        }}
        disabled={resumeDisabled}
        onClick={onResume}
      >
        {/* cooldown indication — left-to-right fill (no text change → the button doesn't jump) */}
        {resumeDisabled && (
          <span style={{
            position: 'absolute', left: 0, top: 0, bottom: 0,
            width: `${cooldownPct}%`,
            background: 'rgba(120,180,255,0.28)',
          }} />
        )}
        <span style={{ position: 'relative' }}>{t.pauseResume}</span>
      </button>
      <Button variant="ghost" onClick={onBack} data-testid="pause-to-menu">{t.pauseToMenu}</Button>
      {showExit && <Button variant="ghost" onClick={onExit} data-testid="pause-exit">{t.pauseExit}</Button>}
    </div>
  )
}
