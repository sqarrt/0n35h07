import { useEffect, useState } from 'react'
import type { AnnounceItem } from '../hooks/useGameHUD'
import { tierWord } from '../game/streak'
import { EffectText } from './EffectText'

/** Streak/CATALYST banner under the timer. Appears in place (CSS ks-annShow) while announce is not null. */
export function StreakBanner({ announce }: { announce: AnnounceItem | null }) {
  // the key forces the appear animation to replay on each new announce
  const [seq, setSeq] = useState(0)
  useEffect(() => { if (announce) setSeq(s => s + 1) }, [announce])
  if (!announce) return null
  const text = `${announce.name}: ${tierWord(announce.kind)}`
  return (
    <div className="streak-banner" data-testid="streak-banner" data-kind={announce.kind}>
      <div key={seq} className="streak-banner--in">
        <EffectText text={text} kind={announce.kind} color={announce.color} />
      </div>
    </div>
  )
}
