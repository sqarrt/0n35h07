/**
 * Trailer screen: a montage of demo recordings (TrailerSequencer) — countdown → replay cuts → finale,
 * with text and music. Clips are loaded by the sequencer from /public/demos.
 */
import { TrailerSequencer } from './TrailerSequencer'
import { ForceLocale } from '../../i18n'

export function TrailerScreen({ masterVolume, onDone }: { masterVolume: number; onDone: () => void }) {
  // The trailer is always in English (Steam target audience), regardless of the language in settings.
  return (
    <ForceLocale id="en">
      <TrailerSequencer masterVolume={masterVolume} onDone={onDone} />
    </ForceLocale>
  )
}
