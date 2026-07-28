import { useState } from 'react'
import type { PlayerProfile } from '../settings'
import { Button } from '../ui/Button'
import { useT } from '../i18n'
import { SoundControls, GraphicsControls } from './SettingsControls'

type Tab = 'sound' | 'graphics'

/** Compact in-match settings (Sound + Graphics only), shown inside the pause overlay. Changes are
 *  written to the live profile (persist + apply immediately) by the shared controls. */
export function MatchSettings({ profile, onChange, onBack }: { profile: PlayerProfile; onChange: (p: PlayerProfile) => void; onBack: () => void }) {
  const t = useT()
  const [tab, setTab] = useState<Tab>('sound')
  return (
    <div className="screen" style={{ background: 'rgba(10,10,15,0.85)' }}>
      <h2 style={{ color: '#4af', letterSpacing: '0.2em', marginBottom: '1.4rem', marginTop: 0 }}>{t.settingsTitle}</h2>
      <div style={{ display: 'flex', gap: '0.6rem', marginBottom: '1.6rem' }}>
        {(['sound', 'graphics'] as Tab[]).map(id => (
          <button key={id} className={`seg${tab === id ? ' seg--on' : ''}`} data-testid={`match-settings-tab-${id}`} onClick={() => setTab(id)}>
            {id === 'sound' ? t.settingsSecSound : t.settingsSecGraphics}
          </button>
        ))}
      </div>
      <div style={{ width: 'min(28rem, 80vw)' }}>
        {tab === 'sound' && <SoundControls profile={profile} onChange={onChange} />}
        {tab === 'graphics' && <GraphicsControls profile={profile} onChange={onChange} inMatch />}
      </div>
      <Button variant="ghost" onClick={onBack} data-testid="match-settings-back">{t.settingsBack}</Button>
    </div>
  )
}
