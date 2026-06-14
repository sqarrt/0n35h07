import type { DurationFilter } from '../../constants'
import { MATCH_DURATIONS_MIN } from '../../constants'
import { useT } from '../../i18n'
import { useSfx } from '../../sfx/SfxContext'

interface TimePickerProps {
  durationSel: DurationFilter
  onSetDuration: (d: DurationFilter) => void
}

/** Раздел «// ВРЕМЯ»: одиночный выбор длительности матча. */
export function TimePicker({ durationSel, onSetDuration }: TimePickerProps) {
  const t = useT()
  const sfx = useSfx()
  const selectTime = (m: number) => { sfx.play2D('ui_toggle'); onSetDuration([m]) }

  return (
    <div className="lobby-ogrp">
      <span className="lobby-ol">// {t.lobbyTime}</span>
      <div className="lobby-segs">
        {MATCH_DURATIONS_MIN.map(m => (
          <button key={m} className={`seg${durationSel.includes(m) ? ' seg--on' : ''}`} data-testid={`lobby-time-${m}`} onClick={() => selectTime(m)}>{t.roomDurationMin(m)}</button>
        ))}
      </div>
    </div>
  )
}
