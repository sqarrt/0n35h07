import type { CSSProperties } from 'react'

/**
 * "Apple Glass" surface — shared by the Radio mini-player and the Radio screen card.
 * Frosted translucent panel: blur+saturate backdrop, hairline border, top specular highlight.
 */
export const glassCard: CSSProperties = {
  background: 'rgba(10, 15, 20, 0.55)',
  backdropFilter: 'blur(24px) saturate(160%)',
  WebkitBackdropFilter: 'blur(24px) saturate(160%)',
  border: '1px solid rgba(255, 255, 255, 0.12)',
  boxShadow:
    'inset 0 1px 0 rgba(255, 255, 255, 0.18), 0 8px 40px rgba(0, 0, 0, 0.5), 0 0 0 0.5px rgba(255, 255, 255, 0.06)',
  borderRadius: 14,
}
