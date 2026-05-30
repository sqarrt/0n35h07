export function HelpOverlay() {
  return (
    <div style={{
      position: 'fixed', inset: 0,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.75)',
      color: 'white', fontFamily: 'monospace',
      gap: 16, cursor: 'pointer', zIndex: 20,
    }}>
      <div style={{ fontSize: 32, letterSpacing: 4, fontWeight: 'bold' }}>ONESHOT</div>
      <div style={{ fontSize: 14, opacity: 0.7 }}>Click to play</div>
      <div style={{ fontSize: 12, opacity: 0.5, marginTop: 8, lineHeight: 1.8, textAlign: 'center' }}>
        WASD — move &nbsp;|&nbsp; Mouse — look<br />
        ЛКМ — beam &nbsp;|&nbsp; ПКМ — shield &nbsp;|&nbsp; Space — jump
      </div>
    </div>
  )
}
