import { useT } from '../i18n'
import type { CSSProperties } from 'react'

const backdrop: CSSProperties = { position: 'fixed', inset: 0, zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)' }
const card: CSSProperties = { minWidth: 320, maxWidth: 420, padding: '22px 24px', borderRadius: 14, background: 'rgba(20,24,30,0.96)', border: '1px solid rgba(255,255,255,0.10)', color: '#cdd', textAlign: 'center', font: 'inherit', fontFamily: 'var(--ui-font)' }
const title: CSSProperties = { fontSize: '0.95rem', letterSpacing: '0.04em', lineHeight: 1.5, marginBottom: 18 }
const row: CSSProperties = { display: 'flex', gap: 12, justifyContent: 'center' }
const btn = (accent: boolean): CSSProperties => ({ appearance: 'none', cursor: 'pointer', flex: '1 1 0', maxWidth: 160, padding: '10px 0', borderRadius: 10, font: 'inherit', fontFamily: 'var(--ui-font)', fontSize: '0.78rem', letterSpacing: '0.12em', border: accent ? '1px solid rgba(68,170,255,0.5)' : '1px solid rgba(255,255,255,0.14)', background: accent ? 'rgba(68,170,255,0.16)' : 'rgba(255,255,255,0.05)', color: accent ? '#bcd' : '#aab' })

/** In-app invite prompt (replaces the Steam overlay, which can't render over WebView2). Name + Accept/Decline. */
export function InviteModal({ inviterName, onAccept, onDecline }: { inviterName: string; onAccept: () => void; onDecline: () => void }) {
  const t = useT()
  return (
    <div style={backdrop} data-testid="invite-modal">
      <div style={card}>
        <div style={title}><strong>{inviterName}</strong> {t.inviteTitle}</div>
        <div style={row}>
          <button style={btn(true)} onClick={onAccept} data-testid="invite-accept">{t.inviteAccept}</button>
          <button style={btn(false)} onClick={onDecline} data-testid="invite-decline">{t.inviteDecline}</button>
        </div>
      </div>
    </div>
  )
}
