interface ScreenFlashesProps {
  beamFlash:    boolean
  playerHit:    boolean
  shieldBlock:  boolean
  botShieldHit: boolean
  shieldVisible: boolean
}

export function ScreenFlashes({ beamFlash, playerHit, shieldBlock, botShieldHit, shieldVisible }: ScreenFlashesProps) {
  return (
    <>
      {/* Виньетка + сетка при активном щите */}
      <div style={{
        position: 'fixed', inset: 0,
        boxShadow: shieldVisible ? 'inset 0 0 140px rgba(65,105,225,0.6)' : 'none',
        backgroundImage: shieldVisible
          ? 'linear-gradient(rgba(65,105,225,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(65,105,225,0.07) 1px, transparent 1px)'
          : 'none',
        backgroundSize: '40px 40px',
        transition: 'box-shadow 0.15s ease',
        pointerEvents: 'none', zIndex: 10,
      }} />

      {shieldBlock && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,180,255,0.07)',
          pointerEvents: 'none', zIndex: 16,
        }} />
      )}
      {playerHit && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(255,0,0,0.08)',
          pointerEvents: 'none', zIndex: 15,
        }} />
      )}
      {beamFlash && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,255,255,0.04)',
          pointerEvents: 'none', zIndex: 15,
        }} />
      )}
    </>
  )
}
