import { useCallback, useEffect, useState } from 'react'
import { Button } from '../ui/Button'
import { listMaps, deleteMap, renameMap } from './mapsApi'
import './editor.css'

/** Navigate to a specific map's editor: /#editor-<name>. */
const openMap = (name: string) => { window.location.hash = `editor-${encodeURIComponent(name)}` }

/** Picker screen (/#editor) styled like the main menu: open/rename/delete a map from src/maps or create a new one. */
export function MapPicker() {
  const [maps, setMaps] = useState<string[] | null>(null)
  const [newName, setNewName] = useState('')

  const refresh = useCallback(() => { void listMaps().then(setMaps) }, [])
  useEffect(() => { refresh() }, [refresh])

  const name = newName.trim()
  const create = () => { if (name) openMap(name) }

  const rename = async (n: string) => {
    const nn = prompt('New map name:', n)?.trim()
    if (!nn || nn === n) return
    if (await renameMap(n, nn)) refresh()
    else alert('Failed to rename')
  }
  const remove = async (n: string) => {
    if (!confirm(`Delete map "${n}"?`)) return
    if (await deleteMap(n)) refresh()
    else alert('Failed to delete')
  }

  return (
    <div className="editor-root editor-picker">
      <div className="menu-panel editor-pick-panel">
        <div className="panel-fill editor-pick">
          <h1 className="editor-pick-title">MAP EDITOR</h1>
          <div className="accent-rule" />

          <div className="editor-pick-section">EXISTING MAPS</div>
          <div className="editor-pick-list">
            {maps === null && <div className="editor-dim">loading…</div>}
            {maps?.length === 0 && <div className="editor-dim">no maps yet — create one below</div>}
            {maps?.map(n => (
              <div key={n} className="editor-pick-row">
                <Button variant="secondary" className="editor-pick-item" onClick={() => openMap(n)}>{n}</Button>
                <button className="editor-pick-act" aria-label="rename" onClick={() => rename(n)}>✎</button>
                <button className="editor-pick-act editor-pick-act--del" aria-label="delete" onClick={() => remove(n)}>✕</button>
              </div>
            ))}
          </div>

          <div className="editor-pick-section">NEW MAP</div>
          <div className="editor-pick-new">
            <input
              className="input" type="text" value={newName} autoFocus
              placeholder="map name"
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') create() }}
            />
            <Button variant="primary" onClick={create} disabled={!name}>CREATE</Button>
          </div>

          <a className="editor-exit" href="#">← to menu</a>
        </div>
      </div>
    </div>
  )
}
