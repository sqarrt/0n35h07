import { useState } from 'react'
import type { MapFilter, MapId } from '../../constants'
import { MAP_IDS, MAP_PREVIEW, MAPS } from '../../game/maps'
import { MapPreview } from '../../components/MapPreview'
import { useT } from '../../i18n'
import { useSfx } from '../../sfx/SfxContext'

interface MapPickerProps {
  mapSel: MapFilter
  onSetMap: (m: MapFilter) => void
}

/** "// MAP" section: single selection by default; MULTI toggles the mode, SELECT ALL enables multi-select. */
export function MapPicker({ mapSel, onSetMap }: MapPickerProps) {
  const t = useT()
  const sfx = useSfx()
  const [mapMulti, setMapMulti] = useState(false)

  const toggleMap = (id: MapId) => {
    sfx.play2D('ui_toggle')
    if (!mapMulti) { onSetMap([id]); return }                          // single: replace selection
    const next = mapSel.includes(id) ? mapSel.filter(x => x !== id) : [...mapSel, id]
    if (next.length) onSetMap(next)                                    // multi: toggle, can't deselect the last one
  }
  const setMulti = (on: boolean) => { sfx.play2D('ui_toggle'); setMapMulti(on); if (!on && mapSel.length > 1) onSetMap([mapSel[0]]) }
  const selectAll = () => { sfx.play2D('ui_toggle'); setMapMulti(true); onSetMap(MAP_IDS) }   // "select all" enables multi-select

  return (
    <div className="lobby-ogrp">
      <div className="lobby-ol-row">
        <span className="lobby-ol">// {t.lobbyMap}</span>
        <div className="lobby-ol-actions">
          <button className={`seg${mapMulti ? ' seg--on' : ''}`} data-testid="lobby-map-multi" onClick={() => setMulti(!mapMulti)}>{t.lobbyMulti}</button>
          <button className="seg" data-testid="lobby-map-all" onClick={selectAll}>{t.lobbySelectAll}</button>
        </div>
      </div>
      <div className="lobby-maptiles">
        {MAP_IDS.map(id => (
          <button key={id} className={`map-tile${mapSel.includes(id) ? ' map-tile--on' : ''}`} data-testid={`lobby-map-${id}`} aria-pressed={mapSel.includes(id)} onClick={() => toggleMap(id)}>
            {MAP_PREVIEW[id] ? <img className="map-preview" src={MAP_PREVIEW[id]} alt={id} /> : <MapPreview map={MAPS[id]} />}
            <span className="map-tile-label">{id}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
