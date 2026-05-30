import type { CSSProperties } from 'react'

export const screenOverlay: CSSProperties = {
  position: 'fixed', inset: 0,
  background: '#0a0a0f',
  display: 'flex', flexDirection: 'column',
  alignItems: 'center', justifyContent: 'center',
  fontFamily: 'monospace', color: '#ccd',
  zIndex: 100,
}

export const btn: CSSProperties = {
  background: 'transparent',
  border: '1px solid #4af',
  color: '#4af',
  padding: '0.75rem 2rem',
  fontFamily: 'monospace',
  fontSize: '1rem',
  letterSpacing: '0.1em',
  cursor: 'pointer',
  margin: '0.4rem 0',
  minWidth: '220px',
}

export const dimBtn: CSSProperties = {
  ...btn,
  borderColor: '#445',
  color: '#556',
}
