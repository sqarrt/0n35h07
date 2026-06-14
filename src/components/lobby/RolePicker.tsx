import { type CSSProperties } from 'react'
import { useT } from '../../i18n'
import { useSfx } from '../../sfx/SfxContext'
import type { SearchRole } from '../../settings'

const LABEL: CSSProperties = { color: '#556', fontSize: '0.7rem', letterSpacing: '0.15em', marginBottom: '0.6rem' }

interface RolePickerProps {
  mode: SearchRole
  disabled: boolean            // соперник в слоте → роль менять нельзя
  onSetRole: (mode: SearchRole) => void
}

/** Выбор сетевой роли (ОБА/КЛИЕНТ): подпись + ряд .seg. ОБА — дефолт (хост/клиент как повезёт). */
export function RolePicker({ mode, disabled, onSetRole }: RolePickerProps) {
  const t = useT()
  const sfx = useSfx()
  const set = (m: SearchRole) => { if (m !== mode && !disabled) { sfx.play2D('ui_toggle'); onSetRole(m) } }
  const seg = (m: SearchRole, label: string, testid: string) => (
    <button className={`seg${mode === m ? ' seg--on' : ''}`} data-testid={testid} disabled={disabled} onClick={() => set(m)}>{label}</button>
  )

  return (
    <div className="lobby-role">
      <div style={LABEL}>{t.lobbyRoleLabel}</div>
      <div className="lobby-segs">
        {seg('both', t.lobbyRoleBoth, 'lobby-role-both')}
        {seg('client', t.settingsSearchRoleClient, 'lobby-role-client')}
      </div>
    </div>
  )
}
