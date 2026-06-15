/**
 * Экран трейлера: монтаж из демо-записей (TrailerSequencer) — countdown → нарезка реплея → финал,
 * с текстом и музыкой. Клипы грузятся секвенсором из /public/demos.
 */
import { TrailerSequencer } from './TrailerSequencer'
import { ForceLocale } from '../../i18n'

export function TrailerScreen({ masterVolume, onDone }: { masterVolume: number; onDone: () => void }) {
  // Трейлер всегда на английском (целевая аудитория Steam), независимо от языка в настройках.
  return (
    <ForceLocale id="en">
      <TrailerSequencer masterVolume={masterVolume} onDone={onDone} />
    </ForceLocale>
  )
}
