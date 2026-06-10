import { useState } from 'react'
import type { CSSProperties } from 'react'
import { NAME_MAX, saveProfile, CONNECT_TIMEOUT_OPTIONS } from '../settings'
import type { PlayerProfile, DefaultView } from '../settings'
import { Button } from '../ui/Button'
import { Toggle } from '../ui/Toggle'
import { Slider } from '../ui/Slider'
import { RelaysSection } from './RelaysSection'
import { useSfx } from '../sfx/SfxContext'

interface SettingsProps {
  profile: PlayerProfile
  onChange: (p: PlayerProfile) => void
  onBack: () => void
}

type Section = 'player' | 'sound' | 'net' | 'graphics'

const label: CSSProperties = { color: '#556', fontSize: '0.7rem', letterSpacing: '0.15em', marginBottom: '0.6rem' }
const row: CSSProperties = { display: 'flex', gap: '0.6rem', marginBottom: '1.6rem' }
// Визуальный подзаголовок-группа внутри раздела (не вкладка).
const subHeader: CSSProperties = {
  color: 'var(--accent-dim)', fontSize: '0.85rem', letterSpacing: '0.18em',
  marginBottom: '1.1rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--surface-line)',
}

const SECTIONS: { id: Section; label: string }[] = [
  { id: 'player', label: 'ИГРОК' },
  { id: 'sound', label: 'ЗВУК' },
  { id: 'net', label: 'СЕТЬ' },
  { id: 'graphics', label: 'ГРАФИКА' },
]

export function Settings({ profile, onChange, onBack }: SettingsProps) {
  const sfx = useSfx()
  const [section, setSection] = useState<Section>('player')
  const [name, setName] = useState(profile.name)
  const [view, setView] = useState<DefaultView>(profile.defaultView)
  const [post, setPost] = useState(profile.postProcessing)
  const [showFps, setShowFps] = useState(profile.showFps)
  const [showSpeed, setShowSpeed] = useState(profile.showSpeed)
  const [menuGlow, setMenuGlow] = useState(profile.menuGlow)
  const [audioViz, setAudioViz] = useState(profile.audioViz)
  const [connTimeout, setConnTimeout] = useState(profile.connectTimeoutSec)
  const [volMaster, setVolMaster] = useState(profile.volumeMaster)
  const [volMusic, setVolMusic] = useState(profile.volumeMusic)
  const [volSfx, setVolSfx] = useState(profile.volumeSfx)
  const [volMenuMusic, setVolMenuMusic] = useState(profile.volumeMenuMusic)

  const commit = (p: PlayerProfile) => { saveProfile(p); onChange(p) }
  // Не-косметические поля — косметика теперь живёт в экране «Внешность» и коммитится там.
  const base = (): PlayerProfile => ({ ...profile, name, defaultView: view, postProcessing: post, showFps, showSpeed, menuGlow, audioViz, volumeMaster: volMaster, volumeMusic: volMusic, volumeSfx: volSfx, volumeMenuMusic: volMenuMusic, connectTimeoutSec: connTimeout })

  const handleName = (v: string) => {
    const next = v.slice(0, NAME_MAX)
    setName(next)
    commit({ ...base(), name: next })
  }
  const handleView = (v: DefaultView) => {
    if (v !== view) sfx.play2D('ui_toggle')
    setView(v)
    commit({ ...base(), defaultView: v })
  }
  const handlePost = (v: boolean) => {
    setPost(v)
    commit({ ...base(), postProcessing: v })
  }
  const handleShowFps = (v: boolean) => {
    setShowFps(v)
    commit({ ...base(), showFps: v })
  }
  const handleShowSpeed = (v: boolean) => {
    setShowSpeed(v)
    commit({ ...base(), showSpeed: v })
  }
  const handleMenuGlow = (v: boolean) => {
    setMenuGlow(v)
    commit({ ...base(), menuGlow: v })
  }
  const handleAudioViz = (v: boolean) => {
    setAudioViz(v)
    commit({ ...base(), audioViz: v })
  }
  const handleConnTimeout = (v: number) => {
    if (v !== connTimeout) sfx.play2D('ui_toggle')
    setConnTimeout(v)
    commit({ ...base(), connectTimeoutSec: v })
  }
  const handleVolMaster = (v: number) => {
    setVolMaster(v)
    commit({ ...base(), volumeMaster: v })
  }
  const handleVolMusic = (v: number) => {
    setVolMusic(v)
    commit({ ...base(), volumeMusic: v })
  }
  const handleVolSfx = (v: number) => {
    setVolSfx(v)
    commit({ ...base(), volumeSfx: v })
  }
  const handleVolMenuMusic = (v: number) => {
    setVolMenuMusic(v)
    commit({ ...base(), volumeMenuMusic: v })
  }

  return (
    // Панель настроек не уезжает вправо — сдвиг принадлежит экрану «Внешность».
    // Выравнивание по верху: заголовок и вкладки не двигаются при смене раздела (разная высота контента).
    <div className="panel-fill" style={{ justifyContent: 'flex-start', paddingTop: '6vh' }}>
      <h2 style={{ color: 'var(--accent)', letterSpacing: '0.2em', marginBottom: '1rem', marginTop: 0 }}>НАСТРОЙКИ</h2>

      {/* Разделы */}
      <div style={{ ...row, marginBottom: '1.8rem' }}>
        {SECTIONS.map(s => (
          <button key={s.id} className={`seg${section === s.id ? ' seg--on' : ''}`} onClick={() => { if (s.id !== section) sfx.play2D('ui_toggle'); setSection(s.id) }}>
            {s.label}
          </button>
        ))}
      </div>

      {section === 'player' && (
        <>
          <div style={{ marginBottom: '1.6rem' }}>
            <div style={label}>ИМЯ</div>
            <input
              className="input"
              value={name}
              onChange={e => handleName(e.target.value)}
              maxLength={NAME_MAX}
              aria-label="Имя игрока"
              style={{ fontSize: '1.3rem', letterSpacing: '0.1em', padding: '0.5rem 1rem', width: '16rem' }}
            />
          </div>

          <div style={label}>ВИД ПО УМОЛЧАНИЮ</div>
          <div style={row}>
            {(['fp', 'tp'] as DefaultView[]).map(v => (
              <button key={v} className={`seg${view === v ? ' seg--on' : ''}`} onClick={() => handleView(v)}>
                {v === 'fp' ? 'ОТ 1 ЛИЦА' : 'ОТ 3 ЛИЦА'}
              </button>
            ))}
          </div>
        </>
      )}

      {section === 'sound' && (
        <>
          <div style={subHeader}>ГРОМКОСТЬ</div>
          <Slider label="ОБЩАЯ ГРОМКОСТЬ" value={volMaster} onChange={handleVolMaster} />
          <Slider label="МУЗЫКА" value={volMusic} onChange={handleVolMusic} />
          <Slider label="МУЗЫКА В МЕНЮ" value={volMenuMusic} onChange={handleVolMenuMusic} />
          <Slider label="ЭФФЕКТЫ" value={volSfx} onChange={handleVolSfx} />
        </>
      )}

      {section === 'net' && (
        <>
          <div style={{ ...label, marginBottom: '0.6rem' }}>ТАЙМАУТ ПОДКЛЮЧЕНИЯ К ЛОББИ</div>
          <div style={{ ...row, flexWrap: 'wrap' }}>
            {CONNECT_TIMEOUT_OPTIONS.map(s => (
              <button key={s} className={`seg${connTimeout === s ? ' seg--on' : ''}`} onClick={() => handleConnTimeout(s)}>{s} С</button>
            ))}
          </div>
          <RelaysSection />
        </>
      )}

      {section === 'graphics' && (
        <>
          <div style={subHeader}>ПОСТПРОЦЕССИНГ</div>
          <div style={{ ...row, alignItems: 'center', gap: '0.9rem' }}>
            <Toggle checked={post} onChange={handlePost} aria-label="Подсвечивать контуры блоков" />
            <span style={{ ...label, marginBottom: 0 }}>ПОДСВЕЧИВАТЬ КОНТУРЫ БЛОКОВ</span>
          </div>
          <div style={{ ...row, alignItems: 'center', gap: '0.9rem' }}>
            <Toggle checked={menuGlow} onChange={handleMenuGlow} aria-label="Свечение в меню" />
            <span style={{ ...label, marginBottom: 0 }}>СВЕЧЕНИЕ В МЕНЮ</span>
          </div>
          <div style={{ ...row, alignItems: 'center', gap: '0.9rem' }}>
            <Toggle checked={audioViz} onChange={handleAudioViz} aria-label="Визуализация звука" />
            <span style={{ ...label, marginBottom: 0 }}>ВИЗУАЛИЗАЦИЯ ЗВУКА</span>
          </div>

          <div style={subHeader}>ОВЕРЛЕЙ</div>
          <div style={{ ...row, alignItems: 'center', gap: '0.9rem' }}>
            <Toggle checked={showFps} onChange={handleShowFps} aria-label="Выводить счётчик кадров" />
            <span style={{ ...label, marginBottom: 0 }}>ВЫВОДИТЬ СЧЁТЧИК КАДРОВ</span>
          </div>
          <div style={{ ...row, alignItems: 'center', gap: '0.9rem' }}>
            <Toggle checked={showSpeed} onChange={handleShowSpeed} aria-label="Выводить скорость игрока" />
            <span style={{ ...label, marginBottom: 0 }}>ВЫВОДИТЬ СКОРОСТЬ ИГРОКА</span>
          </div>
        </>
      )}

      {/* «НАЗАД» прижата к низу панели (marginTop:auto), не зависит от высоты раздела. */}
      <Button variant="ghost" onClick={onBack} style={{ marginTop: 'auto' }}>НАЗАД</Button>
    </div>
  )
}
