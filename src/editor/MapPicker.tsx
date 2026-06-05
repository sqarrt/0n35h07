import { useCallback, useEffect, useState } from 'react'
import { Button } from '../ui/Button'
import { listMaps, deleteMap, renameMap } from './mapsApi'
import './editor.css'

/** Переход в редактор конкретной карты: /#editor-<название>. */
const openMap = (name: string) => { window.location.hash = `editor-${encodeURIComponent(name)}` }

/** Экран выбора (/#editor) в стиле главного меню: открыть/переименовать/удалить карту из src/maps или создать новую. */
export function MapPicker() {
  const [maps, setMaps] = useState<string[] | null>(null)
  const [newName, setNewName] = useState('')

  const refresh = useCallback(() => { void listMaps().then(setMaps) }, [])
  useEffect(() => { refresh() }, [refresh])

  const name = newName.trim()
  const create = () => { if (name) openMap(name) }

  const rename = async (n: string) => {
    const nn = prompt('Новое имя карты:', n)?.trim()
    if (!nn || nn === n) return
    if (await renameMap(n, nn)) refresh()
    else alert('Не удалось переименовать')
  }
  const remove = async (n: string) => {
    if (!confirm(`Удалить карту «${n}»?`)) return
    if (await deleteMap(n)) refresh()
    else alert('Не удалось удалить')
  }

  return (
    <div className="editor-root editor-picker">
      <div className="menu-panel editor-pick-panel">
        <div className="panel-fill editor-pick">
          <h1 className="editor-pick-title">РЕДАКТОР КАРТ</h1>
          <div className="accent-rule" />

          <div className="editor-pick-section">СУЩЕСТВУЮЩИЕ КАРТЫ</div>
          <div className="editor-pick-list">
            {maps === null && <div className="editor-dim">загрузка…</div>}
            {maps?.length === 0 && <div className="editor-dim">пока нет карт — создай новую ниже</div>}
            {maps?.map(n => (
              <div key={n} className="editor-pick-row">
                <Button variant="secondary" className="editor-pick-item" onClick={() => openMap(n)}>{n}</Button>
                <button className="editor-pick-act" title="переименовать" onClick={() => rename(n)}>✎</button>
                <button className="editor-pick-act editor-pick-act--del" title="удалить" onClick={() => remove(n)}>✕</button>
              </div>
            ))}
          </div>

          <div className="editor-pick-section">НОВАЯ КАРТА</div>
          <div className="editor-pick-new">
            <input
              className="input" type="text" value={newName} autoFocus
              placeholder="имя карты"
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') create() }}
            />
            <Button variant="primary" onClick={create} disabled={!name}>СОЗДАТЬ</Button>
          </div>

          <a className="editor-exit" href="#">← в меню</a>
        </div>
      </div>
    </div>
  )
}
