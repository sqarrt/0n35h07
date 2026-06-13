import { useEffect, useState } from 'react'
import type { AnnounceItem } from '../hooks/useGameHUD'
import { tierWord } from '../game/streak'
import { EffectText } from './EffectText'

/** Баннер серии/CATALYST под таймером. Появляется на месте (CSS ks-annShow), пока announce не null. */
export function StreakBanner({ announce }: { announce: AnnounceItem | null }) {
  // ключ форсит реанимацию появления на каждый новый анонс
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
