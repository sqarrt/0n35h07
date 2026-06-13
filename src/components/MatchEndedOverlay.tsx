import type { CSSProperties } from 'react'
import type { MatchResult } from '../hooks/useGameHUD'
import { Button } from '../ui/Button'
import { useT } from '../i18n'

// Цвет исхода — семантика, а не текст; подпись берётся из словаря по ключу исхода.
const OUTCOME_COLOR: Record<MatchResult['outcome'], string> = {
  win:  'var(--ok)',
  lose: 'var(--danger)',
  draw: '#fd4',
}

const FADE = '@keyframes matchEndFade { from { opacity: 0 } to { opacity: 1 } }'

// Затемнение под баром (z 30 — ниже выросшего .match-hud.ended, z 31).
const wrap: CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 30, background: 'rgba(7,10,14,0.9)',
  fontFamily: 'var(--ui-font)', color: 'var(--text)',
  animation: 'matchEndFade 0.1s ease-out',   // короткое появление после стоп-кадра конца матча
}
// Исход/причина/кнопка обрамляют центр фиксированными отступами — выросший HUD-бар встаёт между ними (без «прыжков»).
const outcome: CSSProperties = {
  position: 'absolute', left: 0, right: 0, bottom: 'calc(50% + 54px)', textAlign: 'center',
  fontSize: 52, letterSpacing: '0.22em', margin: 0, paddingLeft: '0.22em',
}
const reason: CSSProperties = {
  position: 'absolute', left: 0, right: 0, top: 'calc(50% + 46px)', textAlign: 'center',
  fontSize: 12, letterSpacing: '0.2em', color: '#7a8694',
}
const exitRow: CSSProperties = {
  position: 'absolute', left: 0, right: 0, top: 'calc(50% + 84px)',
  display: 'flex', justifyContent: 'center',
}

/** Экран конца матча: исход + причина + ВЫЙТИ. Итоговый счёт показывает сам HUD-бар, выросший в центр. */
export function MatchEndedOverlay({ result, onExit }: { result: MatchResult; onExit: () => void }) {
  const t = useT()
  const color = OUTCOME_COLOR[result.outcome]
  const outcomeLabel: Record<MatchResult['outcome'], string> = {
    win: t.matchOutcomeWin, lose: t.matchOutcomeLose, draw: t.matchOutcomeDraw,
  }
  const reasonLabel: Record<MatchResult['reason'], string> = {
    time: t.matchReasonTime, disconnect: t.matchReasonDisconnect,
  }
  return (
    <div style={wrap}>
      <style>{FADE}</style>
      <h1 data-testid="match-outcome" style={{ ...outcome, color, textShadow: `0 0 26px ${color}` }}>
        {outcomeLabel[result.outcome]}
      </h1>
      <div data-testid="match-reason" style={reason}>{reasonLabel[result.reason]}</div>
      <div style={exitRow}>
        <Button variant="primary" onClick={onExit} data-testid="match-exit">{t.matchExit}</Button>
      </div>
    </div>
  )
}
