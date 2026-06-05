import { useEffect, useState } from 'react'
import { MapPicker } from './MapPicker'
import { MapEditor } from './MapEditor'

/** Название редактируемой карты из hash, либо null для экрана выбора (/#editor). */
function mapNameFromHash(): string | null {
  const h = window.location.hash
  if (h.startsWith('#editor-')) return decodeURIComponent(h.slice('#editor-'.length)) || null
  return null
}

/** Дев-маршрутизация редактора: /#editor → выбор карты, /#editor-<название> → редактор этой карты. */
export function EditorRoot() {
  const [name, setName] = useState<string | null>(mapNameFromHash)

  useEffect(() => {
    const onHash = () => setName(mapNameFromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  return name ? <MapEditor key={name} name={name} /> : <MapPicker />
}
