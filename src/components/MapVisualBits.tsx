/**
 * Общие визуальные части карты — чтобы арена выглядела одинаково в игре, редакторе, превью и фоне меню.
 */

/** Единый свет карты (одинаковая яркость/направление во всех контекстах). */
export function MapLights() {
  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 20, 8]} intensity={1.05} castShadow />
    </>
  )
}
