import type { CSSProperties } from 'react'
import { Button } from '../ui/Button'
import { useT } from '../i18n'

// Developer links (moved out of Settings — "About" is now a main-menu screen).
const DEV_NAME = 'Shatalov Dmitriy'
const DEV_LINKS: { label: string; href: string }[] = [
  { label: 'YouTube — @watooh', href: 'https://www.youtube.com/@watooh' },
  { label: 'Twitch — dimonplafon', href: 'https://www.twitch.tv/dimonplafon' },
  { label: 'sqarrt1337@gmail.com', href: 'mailto:sqarrt1337@gmail.com' },
]

const subHeader: CSSProperties = {
  color: 'var(--accent-dim)', fontSize: '0.85rem', letterSpacing: '0.18em',
  marginBottom: '1.1rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--surface-line)',
}

/** "About the game" screen (from the main menu): developer info + the trailer. */
export function About({ onBack, onWatchTrailer }: { onBack: () => void; onWatchTrailer: () => void }) {
  const t = useT()
  return (
    <div className="panel-fill" style={{ justifyContent: 'flex-start', paddingTop: '6vh' }}>
      <h2 style={{ color: 'var(--accent)', letterSpacing: '0.2em', marginBottom: '1rem', marginTop: 0 }}>{t.settingsSecAbout}</h2>

      <div style={subHeader}>{t.aboutDevGroup}</div>
      <div style={{ color: 'var(--accent-dim)', fontSize: '1.05rem', letterSpacing: '0.08em', marginBottom: '1rem' }}>{DEV_NAME}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.8rem' }}>
        {DEV_LINKS.map(l => (
          <a key={l.href} className="about-link" href={l.href} target="_blank" rel="noreferrer">{l.label}</a>
        ))}
      </div>

      <div style={subHeader}>{t.aboutTrailerGroup}</div>
      <Button variant="primary" onClick={onWatchTrailer} data-testid="about-watch-trailer">{t.aboutWatch}</Button>

      <Button variant="ghost" onClick={onBack} data-testid="about-back" style={{ marginTop: 'auto' }}>{t.settingsBack}</Button>
    </div>
  )
}
