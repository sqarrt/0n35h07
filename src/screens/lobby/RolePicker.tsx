import { type CSSProperties } from 'react'
import { useT } from '../../i18n'
import { useSfx } from '../../sfx/SfxContext'

const LABEL: CSSProperties = { color: '#556', fontSize: '0.7rem', letterSpacing: '0.15em', marginBottom: '0.6rem' }

interface RolePickerProps {
  isHost: boolean
  disabled: boolean            // соперник в слоте → роль менять нельзя
  onToggleRole: () => void
}

/** Выбор сетевой роли (ХОСТ/КЛИЕНТ) — паттерн как выбор модели сферы во «Внешности»: подпись + ряд .seg. */
export function RolePicker({ isHost, disabled, onToggleRole }: RolePickerProps) {
  const t = useT()
  const sfx = useSfx()
  const setRole = (host: boolean) => { if (host !== isHost && !disabled) { sfx.play2D('ui_toggle'); onToggleRole() } }

  return (
    <div className="lobby-role">
      <div style={LABEL}>{t.lobbyRoleLabel}</div>
      <div className="lobby-segs">
        <button className={`seg${isHost ? ' seg--on' : ''}`} data-testid="lobby-role-host" disabled={disabled} onClick={() => setRole(true)}>{t.settingsSearchRoleHost}</button>
        <button className={`seg${!isHost ? ' seg--on' : ''}`} data-testid="lobby-role-client" disabled={disabled} onClick={() => setRole(false)}>{t.settingsSearchRoleClient}</button>
      </div>
    </div>
  )
}
