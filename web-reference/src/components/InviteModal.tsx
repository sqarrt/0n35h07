import { useT } from '../i18n'
import { glassCard } from './glass'
import './InviteModal.css'

/** In-app invite toast (replaces the Steam overlay, which can't render over WebView2). A non-blocking glass card in
 *  the bottom-right above the radio player — name + Accept/Decline. */
export function InviteModal({ inviterName, onAccept, onDecline }: { inviterName: string; onAccept: () => void; onDecline: () => void }) {
  const t = useT()
  return (
    <div className="invite-toast" style={glassCard} data-testid="invite-modal" role="dialog" aria-live="polite">
      <div className="invite-title"><strong>{inviterName}</strong> {t.inviteTitle}</div>
      <div className="invite-row">
        <button type="button" className="invite-btn" onClick={onAccept} data-testid="invite-accept">{t.inviteAccept}</button>
        <button type="button" className="invite-btn decline" onClick={onDecline} data-testid="invite-decline">{t.inviteDecline}</button>
      </div>
    </div>
  )
}
