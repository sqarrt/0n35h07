import { useEffect, useState } from 'react'
import { MapPicker } from './MapPicker'
import { MapEditor } from './MapEditor'

/** The edited map's name from the hash, or null for the picker screen (/#editor). */
function mapNameFromHash(): string | null {
  const h = window.location.hash
  if (h.startsWith('#editor-')) return decodeURIComponent(h.slice('#editor-'.length)) || null
  return null
}

/** Dev routing for the editor: /#editor → map picker, /#editor-<name> → editor for that map. */
export function EditorRoot() {
  const [name, setName] = useState<string | null>(mapNameFromHash)

  useEffect(() => {
    const onHash = () => setName(mapNameFromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  return name ? <MapEditor key={name} name={name} /> : <MapPicker />
}
