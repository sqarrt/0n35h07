import { useState, type DragEvent } from 'react'
import { useT } from '../i18n'
import { DT_TRACK, DT_MOVE } from './RadioExplorer'

interface RadioTrashProps {
  onTrackJSON: (json: string) => void  // a track dragged from the PLAYER (a full payload)
  onMovePath: (file: string) => void   // a file dragged from the EXPLORER (a library path)
}

/** The trash bin (bottom-left of the radio screen). Dropping a track here blocks it — it never appears again. */
export function RadioTrash({ onTrackJSON, onMovePath }: RadioTrashProps) {
  const t = useT()
  const [over, setOver] = useState(false)
  return (
    <div className={`rtrash${over ? ' over' : ''}`} data-testid="radio-trash"
      onDragOver={(e) => { e.preventDefault(); setOver(true) }}
      onDragLeave={() => setOver(false)}
      onDrop={(e: DragEvent) => {
        e.preventDefault(); setOver(false)
        const track = e.dataTransfer.getData(DT_TRACK)
        const move = e.dataTransfer.getData(DT_MOVE)
        if (track) onTrackJSON(track)
        else if (move) onMovePath(move)
      }}>
      <div className="rtrash-bin"><span className="lid" /><span className="body" /></div>
      <div className="rtrash-label">{t.radioTrash}</div>
    </div>
  )
}
