import { useState, useEffect, useRef, useCallback, lazy, memo, Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { Game } from './Game'
import { useGameHUD } from './hooks/useGameHUD'
import type { HUDAction } from './hooks/useGameHUD'
import type { ISfxEngine } from './game/audio/sfx/types'
import { Crosshair } from './components/Crosshair'
import { ShieldBrackets } from './components/ShieldBrackets'
import { ScreenFlashes } from './components/ScreenFlashes'
import { WindupOverlay } from './components/WindupOverlay'
import { DashIndicator } from './components/DashIndicator'
import { StatsOverlay } from './components/StatsOverlay'
import { RespawnOverlay } from './components/RespawnOverlay'
import { MatchHud } from './components/MatchHud'
import { StreakBanner } from './components/StreakBanner'
import { EffectDefs } from './components/EffectText'
import { OverheatVignette } from './components/OverheatVignette'
import { ReadyOverlay } from './components/ReadyOverlay'
import { CountdownOverlay } from './components/CountdownOverlay'
import { MatchEndedOverlay } from './components/MatchEndedOverlay'
import { PauseMenu } from './components/PauseMenu'
import { MenuBackdrop } from './components/MenuBackdrop'
import { MapBackground } from './components/MapBackground'
import { NetStatusChip } from './components/NetStatusChip'
import { VersionChip } from './components/VersionChip'
import { EpilepsyWarning } from './components/EpilepsyWarning'
import { MainMenu } from './screens/MainMenu'
import { Lobby } from './screens/Lobby'
import type { LobbySlot } from './screens/Lobby'
import { DEFAULT_LOBBY_TAB } from './components/lobby/types'
import type { LobbyTab } from './components/lobby/types'
import type { GameApi } from './Game'
import { Settings } from './screens/Settings'
import type { SettingsSection } from './screens/Settings'
import { Appearance } from './screens/Appearance'
import type { AppearancePart } from './components/menuStage'
import { loadProfile, saveProfile } from './settings'
import { applyScreenPresence } from './steam/richPresence'
import { hostFriendLobby, joinSteamLobby } from './steam/SteamLobby'
import { SteamQuickMatch } from './steam/SteamQuickMatch'
import { steamInviteToLobby, onSteamNetEvent } from './steam/steam'
import type { PlayerProfile } from './settings'
import { I18nProvider, detectLocale, useT } from './i18n'
import { ThreeSfxEngine } from './game/audio/sfx/ThreeSfxEngine'
import { SfxProvider } from './sfx/SfxContext'
import { WebAudioMusicEngine } from './game/audio/WebAudioMusicEngine'
import { MenuMusic } from './game/audio/MenuMusic'
import { AudioAnalysis } from './game/audio/AudioAnalysis'
import { AudioBar } from './components/AudioBar'
import { POINTERLOCK_COOLDOWN } from './constants'
import { IS_DESKTOP } from './platform'
import type { BallModel, WindupStyle, RespawnStyle, DashStyle, ShieldStyle } from './constants'
import { createNet, resolveNetKind } from './net/createNet'
import { randomRoomCode } from './net/roomCode'
import { generateModelName } from './names'
import { warmMapPreviews, MAP_IDS, ensureMapGeo } from './game/maps'
import { warmRelayCache } from './net/relays'
import { warmTrystero } from './net/TrysteroNet'
import { netDiagSetContext, netDiagSetPeers } from './net/netDiag'
import { lsGet, lsSet, lsRemove } from './storage'
import { useDampedTranslateX } from './hooks/useDampedTranslateX'
import { useDelayedUnmount } from './hooks/useDelayedUnmount'
import { RoomSession } from './net/RoomSession'
import type { RoomView, RoomRole } from './net/RoomSession'
import type { INet, PeerId } from './net/INet'
import type { RosterEntry } from './net/protocol'
import type { MatchRole, MapId, MapFilter, DurationFilter, BotDifficulty } from './constants'
import { DEFAULT_MAP_ID, HOST_ID, OPPONENT_ID, MATCH_DURATIONS_MIN } from './constants'
import { createMatchmakingPool } from './net/createMatchmakingPool'
import type { MatchmakingPool } from './net/matchmaking'
import { DualMatchmaker } from './net/DualMatchmaker'
import { TrailerScreen } from './components/trailer/TrailerScreen'
import type { DemoFile } from './game/demo/demoTypes'

type Screen = 'menu' | 'lobby' | 'game' | 'settings' | 'appearance' | 'trailer'

const BOT_DEFAULT_DIFFICULTY: BotDifficulty = 'normal'   // default bot difficulty on the "vs Bot" tab

const APPEARANCE_PANEL_MARGIN_PX = 24   // panel offset from the right edge of the screen on "Appearance"
// We start Trystero warmup not immediately on canvas-ready but after a pause: let a couple more frames render,
// then catch the synchronous init freeze (~860ms) — it happens BEHIND the warning, unnoticed by the player.
const TRYSTERO_WARM_DELAY_MS = 250

// Map editor — dev only (npm run dev), not included in the prod build (the lazy chunk isn't loaded).
const EditorRoot = lazy(() => import('./editor/EditorRoot').then(m => ({ default: m.EditorRoot })))
const isEditorHash = () => window.location.hash.startsWith('#editor')
const MAP_FADE_MS = 700                  // map background fade in/out duration (in sync with the .map-bg transition)

interface GameNet {
  role: MatchRole
  net: INet
  netConfig: { localId: number; roster: RosterEntry[] }
  peerToPlayer: Map<PeerId, number>
  durationMs: number
  mapId: MapId
  code: string
}

// Dev: download a recorded demo to a file (committed to the repo, later sequenced into the trailer).
function downloadDemo(demo: DemoFile) {
  const blob = new Blob([JSON.stringify(demo)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `oneshot-${Date.now()}.demo.json`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// Camera config — a module-level constant: an inline object would be recreated on every render.
const GAME_CAMERA = { fov: 75, near: 0.1, far: 200, position: [0, 1.7, 5] as [number, number, number] }

interface GameCanvasProps {
  dispatch: (action: HUDAction) => void
  gameNet: GameNet
  reserveColor: string
  defaultThirdPerson: boolean
  apiRef: React.MutableRefObject<GameApi | null>
  sfxEngine: ISfxEngine
  musicVolume: number
  audioAnalysis: AudioAnalysis
}

// HUD actions (charge progress, speed, timer) re-render App dozens of times per second — Canvas must NOT
// be re-rendered along with it. r3f's configure effect (no deps) overwrites size in the r3f store on every
// Canvas render: the rect from useMeasure (8 keys) is compared against state.size (4 keys), and is.equ in r3f 9
// ALWAYS sees a "change". Each new size wakes all useThree subscribers (the whole Game subtree), and re-rendering
// MapEdges forces EffectComposer to rebuild the EffectPass with shaders every frame — an allocation storm
// (~18 MB/s) and multi-second Major GC pauses. memo + stable props cut the cascade off at the root.
// (Same class of pitfall as Game's memo — see the comment in Game.tsx.)
const GameCanvas = memo(function GameCanvas({ dispatch, gameNet, reserveColor, defaultThirdPerson, apiRef, sfxEngine, musicVolume, audioAnalysis }: GameCanvasProps) {
  return (
    /* shadows="percentage" → PCFShadowMap directly (PCFSoftShadowMap is deprecated in three 0.184 and
       falls back to PCF anyway) — same result without the deprecation warning. */
    <Canvas shadows="percentage" camera={GAME_CAMERA}>
      <Game
        dispatch={dispatch}
        role={gameNet.role}
        net={gameNet.net}
        netConfig={gameNet.netConfig}
        peerToPlayer={gameNet.peerToPlayer}
        reserveColor={reserveColor}
        defaultThirdPerson={defaultThirdPerson}
        apiRef={apiRef}
        durationMs={gameNet.durationMs}
        mapId={gameNet.mapId}
        seedCode={gameNet.code}
        sfxEngine={sfxEngine}
        musicVolume={musicVolume}
        audioAnalysis={audioAnalysis}
      />
    </Canvas>
  )
})

// Host-role persistence. `HOSTED_KEY` (localStorage) — the last code we CREATED (survives tab close/browser
// restart). `HOST_LIVE_KEY` — the code a host tab holds RIGHT NOW (cleared on unload). Decision when opening
// #CODE: host if the code is ours AND there's no live host for this code (we're that same tab after
// refresh/reopen); otherwise client. So host refresh/reopen → host again, while a SECOND tab with the first
// still alive (or entry by someone else's code) → client. On another device localStorage isn't shared → client.
const HOSTED_KEY = 'oneshot:hosted'
const HOST_LIVE_KEY = 'oneshot:hostLive'
function forgetHosted() { lsRemove(HOSTED_KEY, HOST_LIVE_KEY) }
function setHostLive(code: string) { lsSet(HOST_LIVE_KEY, code) }
function clearHostLive(code: string) { if (lsGet(HOST_LIVE_KEY) === code) lsRemove(HOST_LIVE_KEY) }

/** Suspense fallback for the lazy editor — under I18nProvider, hence useT. */
function EditorLoading() {
  const t = useT()
  return <div style={{ color: 'var(--accent)', fontFamily: 'var(--ui-font)', padding: 20 }}>{t.editorLoading}</div>
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('menu')
  // The active settings tab lives here so it survives a trip into the trailer and returns to the same tab.
  const [settingsSection, setSettingsSection] = useState<SettingsSection>('player')
  const [editorMode, setEditorMode] = useState(() => import.meta.env.DEV && isEditorHash())
  const [locked, setLocked] = useState(false)
  const [roomView, setRoomView] = useState<RoomView | null>(null)
  const [gameNet, setGameNet] = useState<GameNet | null>(null)
  const [profile, setProfile] = useState<PlayerProfile>(() => loadProfile())
  // initial is read by the provider once — not recomputed on every render (lazy-init, no ref read during render)
  const [initialLocale] = useState(() => profile.locale ?? detectLocale())
  const [appearancePreview, setAppearancePreview] = useState<{ color: string; model: BallModel; ringColor: string; windupStyle: WindupStyle; windupSeq: number; respawnStyle: RespawnStyle; respawnSeq: number; dashStyle: DashStyle; dashSeq: number; shieldStyle: ShieldStyle; shieldSeq: number; part: AppearancePart; ballArt: string | undefined }>(() => ({ color: profile.primaryColor, model: profile.ballModel, ringColor: profile.reserveColor, windupStyle: profile.windupStyle, windupSeq: 0, respawnStyle: profile.respawnStyle, respawnSeq: 0, dashStyle: profile.dashStyle, dashSeq: 0, shieldStyle: profile.shieldStyle, shieldSeq: 0, part: 'color', ballArt: profile.ballArt }))
  // Preview click counters (windupSeq/respawnSeq/dashSeq/shieldSeq) are preserved from the previous state: App
  // owns them (monotonic, survive remounting "Appearance" — otherwise a ghost trigger on re-entry).
  const handlePreview = useCallback((color: string, model: BallModel, ringColor: string, windupStyle: WindupStyle, respawnStyle: RespawnStyle, dashStyle: DashStyle, shieldStyle: ShieldStyle, part: AppearancePart, ballArt: string | undefined) => setAppearancePreview(p => ({ ...p, color, model, ringColor, windupStyle, respawnStyle, dashStyle, shieldStyle, part, ballArt })), [])
  // Style + counter are updated in ONE setState: an intermediate render of "new seq, old style"
  // would trigger the old style's preview and immediately kill it by recreating the effect (a switching bug).
  const handleShotPreview = useCallback((windupStyle: WindupStyle) => setAppearancePreview(p => ({ ...p, windupStyle, windupSeq: p.windupSeq + 1 })), [])
  // The camera angle stays as set (no auto-resets) — it changes only on the next click.
  const handleRespawnPreview = useCallback((respawnStyle: RespawnStyle) => setAppearancePreview(p => ({ ...p, respawnStyle, respawnSeq: p.respawnSeq + 1, part: 'respawn' })), [])
  const handleDashPreview = useCallback((dashStyle: DashStyle) => setAppearancePreview(p => ({ ...p, dashStyle, dashSeq: p.dashSeq + 1, part: 'dash' })), [])
  const handleShieldPreview = useCallback((shieldStyle: ShieldStyle) => setAppearancePreview(p => ({ ...p, shieldStyle, shieldSeq: p.shieldSeq + 1, part: 'shield' })), [])
  const [lockReadyAt, setLockReadyAt] = useState(0)   // when requestPointerLock is allowed again (Chrome cooldown)
  const [now, setNow] = useState(0)                   // tick for the pause countdown
  const { state: hud, dispatch } = useGameHUD()

  // Photosensitivity warning — shown from the FIRST render (so the menu doesn't flash behind it).
  // It overlaps the menu-canvas warmup, but that's safe: all heavy work (Trystero) is deferred until canvas
  // is ready (handleMenuReady), and the WebGL context init itself is light and passes behind the warning cleanly.
  // Under ?net=bc (e2e/local 2 tabs) we don't show the warning — otherwise the overlay would intercept clicks in tests.
  const [showWarning, setShowWarning] = useState(() => !IS_DESKTOP && resolveNetKind() === 'trystero')
  const [menuReady, setMenuReady] = useState(false)
  const handleMenuReady = useCallback(() => setMenuReady(true), [])
  // Canvas warmed up → now it's safe to catch Trystero's synchronous init freeze (~860ms): it'll pass BEHIND
  // the warning, before the player dismisses it → the first "Create room" opens instantly.
  useEffect(() => {
    if (!menuReady || IS_DESKTOP || resolveNetKind() !== 'trystero') return
    const timer = setTimeout(warmTrystero, TRYSTERO_WARM_DELAY_MS)
    return () => clearTimeout(timer)
  }, [menuReady])

  // A single SFX engine for the whole app (one AudioContext: menu + match). Created once (lazy init).
  const [sfx] = useState(() => new ThreeSfxEngine())
  useEffect(() => { void sfx.load() }, [sfx])
  // Effects volume = master × effects (live: UI sounds in the menu react to the slider instantly).
  useEffect(() => { sfx.setMasterGain(profile.volumeMaster * profile.volumeSfx) }, [sfx, profile.volumeMaster, profile.volumeSfx])

  // Menu music (separate engine/context). Volume = master × menu_music (live).
  const [menuMusic] = useState(() => new MenuMusic(new WebAudioMusicEngine()))
  useEffect(() => { menuMusic.setVolume(profile.volumeMaster * profile.volumeMenuMusic) }, [menuMusic, profile.volumeMaster, profile.volumeMenuMusic])
  // Preload buffers ahead of time (decode needs no gesture) → the first gesture starts instantly, without a second action.
  useEffect(() => { void menuMusic.preload() }, [menuMusic])

  // Audio analysis for visualization: combined level from all sources (SFX + menu music; match music is
  // registered by Game). Feeds the glow of the menu orbs and the visualizer bar in the match.
  const [audioAnalysis] = useState(() => new AudioAnalysis())
  useEffect(() => {
    const offs = [
      audioAnalysis.addReader(() => sfx.readLevel()),
      audioAnalysis.addReader(() => menuMusic.readLevel()),
      audioAnalysis.addBandReader(out => sfx.readBands(out)),
      audioAnalysis.addBandReader(out => menuMusic.readBands(out)),
    ]
    return () => { for (const off of offs) off() }
  }, [audioAnalysis, sfx, menuMusic])
  // Plays on all non-game screens, fades out in the match. In the browser the first start is from a user gesture
  // (autoplay policy); on desktop (Tauri) autoplay is allowed → we start immediately, without a gesture.
  const gesturedRef = useRef(IS_DESKTOP)
  useEffect(() => {
    if (screen === 'game' || screen === 'trailer') { menuMusic.stop(); return }   // the trailer runs its own music
    if (gesturedRef.current) { void menuMusic.start(); return }
    const onGesture = () => {
      gesturedRef.current = true
      void menuMusic.start()
      window.removeEventListener('pointerdown', onGesture)
      window.removeEventListener('keydown', onGesture)
    }
    window.addEventListener('pointerdown', onGesture)
    window.addEventListener('keydown', onGesture)
    return () => { window.removeEventListener('pointerdown', onGesture); window.removeEventListener('keydown', onGesture) }
  }, [screen, menuMusic])

  const [lobbyTab, setLobbyTab] = useState<LobbyTab>(DEFAULT_LOBBY_TAB)
  const [botDifficulty, setBotDifficulty] = useState<BotDifficulty>(BOT_DEFAULT_DIFFICULTY)
  const [botName, setBotName] = useState('')   // "vs Bot" tab: bot name (empty = random when added)
  const [searching, setSearching] = useState(false)
  const [steamFriendForming, setSteamFriendForming] = useState(false)   // Steam "With friend": lobby being created
  // Steam "With friend" intended role while the lobby is still forming (no RoomView yet) — host (created the
  // lobby) vs client (joined an invite). Keeps the seat side stable so "me" doesn't flip guest→host mid-forming.
  const [steamFriendHosting, setSteamFriendHosting] = useState(true)
  const [draftSel, setDraftSel] = useState<{ map: MapFilter; durationMin: DurationFilter }>({ map: [MAP_IDS[0]], durationMin: [MATCH_DURATIONS_MIN[0]] })
  const poolRef = useRef<MatchmakingPool | null>(null)
  const dmRef = useRef<DualMatchmaker | null>(null)
  const lobbyCodeRef = useRef<string>('')   // host code for the lobby session (stable across role switches)
  const steamEnterToken = useRef(0)   // bumped on every tab entry/leave → discards a stale async Steam lobby
  const qmRef = useRef<SteamQuickMatch | null>(null)   // Steam quick-match (desktop Matchmaking tab)

  const sessionRef = useRef<RoomSession | null>(null)
  const negotiateNetRef = useRef<INet | null>(null)   // "vs Friend": transport during code rendezvous before role selection
  const gameApiRef = useRef<GameApi | null>(null)

  // Whether the tab's idle state is host (without an active search/connection):
  // bot — always host; matchmaking — host if the profile doesn't force the 'client' role; friend — draft until search.
  const idleIsHost = (tab: LobbyTab): boolean => tab === 'bot' || (tab === 'matchmaking' && profile.searchRole !== 'client')

  const leaveRoom = () => {
    steamEnterToken.current++   // invalidate any in-flight Steam lobby resolution
    setSteamFriendForming(false)
    qmRef.current?.stop(); qmRef.current = null
    sessionRef.current?.dispose()
    sessionRef.current = null
    if (negotiateNetRef.current) { negotiateNetRef.current.leave(); negotiateNetRef.current = null }
    setRoomView(null)
    setGameNet(null)
  }

  // Bind RoomSession to the transport: shared onChange/onStart/onClosed (for enterRoom and enterRoomNegotiated).
  const bindSession = (net: INet, role: RoomRole, code: string, sel?: { map: MapFilter; durationMin: DurationFilter }) => {
    const session = new RoomSession(net, role, code, loadProfile(), sel)
    session.onChange(v => setRoomView(v))
    session.onStart((durationMs, mapId) => {
      const matchRole: MatchRole = session.role === 'host' ? 'host' : 'client'
      // Start preloading geo.json for the map: it'll finish loading before Arena mounts during the countdown.
      void ensureMapGeo(mapId)
      // Reset the previous match's result/time/score — otherwise the old result screen flashes over the new match.
      dispatch({ type: 'RESET_MATCH' })
      // The match starts with the ready ritual — set phase 'ready' ahead of time, else the pause overlay flashes briefly.
      dispatch({ type: 'SET_MATCH_PHASE', phase: 'ready', ready: [], countdown: 0 })
      // Copy of the map: roster cleanup in RoomSession.onPeerLeave must not erase the game's routing.
      setGameNet({ role: matchRole, net, netConfig: session.netConfig(), peerToPlayer: new Map(session.hostPeerToPlayer()), durationMs, mapId, code })
      setScreen('game')
    })
    // Client: host left the lobby / handshake failed → roll back to the current tab's idle state.
    session.onClosed(() => {
      setSearching(false)
      dmRef.current?.stop(); dmRef.current = null
      enterTabIdle(lobbyTab, draftSel)
    })
    sessionRef.current = session
  }

  const enterRoom = (code: string, role: RoomRole, sel?: { map: MapFilter; durationMin: DurationFilter }) => {
    leaveRoom()   // clean up the previous session AND any unfinished rendezvous transport
    if (role === 'host') setHostLive(code)   // mark this tab as the code's live host (cleared on unload)
    const net = createNet(code)
    netDiagSetContext({ role, code, selfId: net.selfId })
    netDiagSetPeers(() => net.peers())
    bindSession(net, role, code, sel)
  }

  // "vs Friend": both peers join room = code; the role is decided deterministically by selfId (smaller = host).
  // Until the opponent appears we hang in rendezvous (negotiateNetRef), then build the resolved-role session on the SAME transport.
  const enterRoomNegotiated = (code: string, sel?: { map: MapFilter; durationMin: DurationFilter }) => {
    leaveRoom()   // clean up the previous session AND the prior rendezvous transport
    const net = createNet(code)
    netDiagSetContext({ role: 'negotiate', code, selfId: net.selfId })
    netDiagSetPeers(() => net.peers())
    negotiateNetRef.current = net
    let resolved = false
    const tryResolve = () => {
      if (resolved || sessionRef.current) return
      const others = net.peers()
      if (!others.length) return
      resolved = true
      negotiateNetRef.current = null   // the transport passes into the session's ownership
      const peerMin = others.reduce((a, b) => (a < b ? a : b))
      const role: RoomRole = net.selfId < peerMin ? 'host' : 'client'
      if (role === 'host') setHostLive(code)
      netDiagSetContext({ role, code, selfId: net.selfId })
      bindSession(net, role, code, sel)
    }
    net.onPeerJoin(() => tryResolve())
    tryResolve()   // in case the opponent is already visible
  }

  // Bring the session to the tab's idle state (without an active search/connection).
  const enterTabIdle = (tab: LobbyTab, sel: { map: MapFilter; durationMin: DurationFilter }) => {
    if (tab === 'bot') {
      // Pre-resolve the name so the seat input starts populated and in sync with the slot (no empty-field mismatch).
      const name = botName.trim() || generateModelName()
      enterRoom(lobbyCodeRef.current, 'host', sel)
      sessionRef.current?.addBot(botDifficulty, name)   // bot straight into the slot
      if (name !== botName) setBotName(name)
    } else if (IS_DESKTOP && tab === 'friend') {
      void enterSteamFriendHost(sel)   // Steam "With friend": create a lobby + host, then invite
    } else if (IS_DESKTOP && tab === 'matchmaking') {
      leaveRoom()   // Steam matchmaking is Steam-only (no WebRTC/cross-play); idle until SEARCH → quick-match
    } else if (idleIsHost(tab)) {
      enterRoom(lobbyCodeRef.current, 'host', sel)   // web matchmaking (both): host session for the announcement
    } else {
      leaveRoom()   // matchmaking+client / web friend → draft until search
    }
  }

  // Steam "With friend" host: create a Private lobby (async) and host a session on its SteamNet.
  // A token guards against the user switching tabs while the lobby is still forming.
  const enterSteamFriendHost = async (sel: { map: MapFilter; durationMin: DurationFilter }) => {
    leaveRoom()
    const token = ++steamEnterToken.current
    setSteamFriendHosting(true)
    setSteamFriendForming(true)
    const net = await hostFriendLobby()
    if (token !== steamEnterToken.current) { net?.leave(); return }   // superseded (tab switch/leave)
    setSteamFriendForming(false)
    if (net) bindSession(net, 'host', '', sel)
  }

  // Steam "With friend" client: a friend's invite/"Join game" → join their lobby + client session.
  // Works from any screen (the listener is global). The token guards the async join.
  const enterSteamFriendClient = async (lobbyId: string) => {
    leaveRoom()
    const token = ++steamEnterToken.current
    setLobbyTab('friend')
    setScreen('lobby')
    setSteamFriendHosting(false)
    setSteamFriendForming(true)
    const net = await joinSteamLobby(lobbyId)
    if (token !== steamEnterToken.current) { net?.leave(); return }
    setSteamFriendForming(false)
    if (net) bindSession(net, 'client', '', draftSel)
  }

  // On entering the menu we warm the live relay cache (self-healing signaling). Internet transport only:
  // under ?net=bc (e2e/local) real WebSocket probes aren't needed and add noise to tests.
  useEffect(() => {
    if (screen === 'menu' && !IS_DESKTOP && resolveNetKind() === 'trystero') void warmRelayCache()
  }, [screen])

  // Warm map previews on start: by the time the room opens, the images are already in the HTTP cache (see warmMapPreviews).
  useEffect(() => { warmMapPreviews() }, [])

  // Steam Rich Presence: reflect the current screen (menu / lobby / match) in the friends list. No-op off-Steam.
  useEffect(() => { applyScreenPresence(screen) }, [screen])

  // Global Steam invite listener: a friend's overlay invite / "Join game" → join their lobby as a client,
  // from any screen. Mounted once (off-Steam it's a no-op subscription).
  useEffect(() => {
    if (!IS_DESKTOP) return
    let alive = true
    let unlisten = () => {}
    void onSteamNetEvent(e => { if (e.kind === 'joinRequested') void enterSteamFriendClient(e.lobbyId) })
      .then(u => { if (alive) unlisten = u; else u() })
    return () => { alive = false; unlisten() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Accidental F5/Ctrl+W in a live match must not silently kill the fight — the browser will ask for confirmation.
  // On desktop (Tauri) we don't set the guard: there beforeunload without a dialog just blocks closing the window.
  useEffect(() => {
    if (IS_DESKTOP || screen !== 'game' || hud.matchPhase !== 'live') return
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [screen, hud.matchPhase])

  // Dev route #editor → map editor (only under npm run dev).
  useEffect(() => {
    const onHash = () => setEditorMode(import.meta.env.DEV && isEditorHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  useEffect(() => {
    const onChange = () => {
      const isLocked = !!document.pointerLockElement
      setLocked(isLocked)
      if (!isLocked) setLockReadyAt(Date.now() + POINTERLOCK_COOLDOWN)
    }
    document.addEventListener('pointerlockchange', onChange)
    return () => document.removeEventListener('pointerlockchange', onChange)
  }, [])

  // Match ended — release the cursor for clicking "EXIT".
  useEffect(() => {
    if (hud.matchResult) document.exitPointerLock?.()
  }, [hud.matchResult])

  // Demo recording for the trailer — dev ONLY: F9 start/stop (in a match), on stop a .demo.json is downloaded.
  // Positive import.meta.env.DEV branch → in the prod build the whole block (and downloadDemo) is stripped by DCE.
  useEffect(() => {
    if (import.meta.env.DEV) {
      const onKey = (e: KeyboardEvent) => {
        if (e.code !== 'F9') return
        const api = gameApiRef.current
        if (!api) return
        if (api.isRecordingDemo()) {
          const demo = api.stopDemo()
          if (demo) { downloadDemo(demo); console.log(`[demo] recorded frames: ${demo.frames.length}`) }
        } else { api.startDemo(); console.log('[demo] recording started (F9 — stop)') }
      }
      window.addEventListener('keydown', onKey)
      return () => window.removeEventListener('keydown', onKey)
    }
  }, [])

  // Tab close/reload → an instant 'bye' to the neighbor (otherwise detected by presence timeout) + clear the
  // live-host flag for this code (refresh/reopen of this same tab will become host again; a second live one — client).
  useEffect(() => {
    const onUnload = () => {
      const s = sessionRef.current
      if (s?.role === 'host') clearHostLive(s.code)
      s?.net.leave()
    }
    window.addEventListener('beforeunload', onUnload)
    return () => window.removeEventListener('beforeunload', onUnload)
  }, [])

  // While the pause is open — tick for the pointer lock cooldown countdown.
  useEffect(() => {
    const isPaused = screen === 'game' && !locked && hud.matchPhase === 'live'
    if (!isPaused) return
    setNow(Date.now())
    const iv = setInterval(() => setNow(Date.now()), 100)
    return () => clearInterval(iv)
  }, [screen, locked, hud.matchPhase])

  // Opponent appeared: host/both — the incomer took the slot (we fix host in the matchmaker); client — ASSIGN arrived.
  useEffect(() => {
    if (!searching || !roomView) return
    if (roomView.isHost && roomView.roster.length > 1) { dmRef.current?.hostConnected(); setSearching(false) }
    if (!roomView.isHost && roomView.connected) setSearching(false)
  }, [searching, roomView])

  const handleSettings = () => setScreen('settings')
  const handleAppearance = () => setScreen('appearance')
  // Exit the game: on desktop (Tauri) closes the window via the API; in the browser — window.close().
  // Dynamic import: @tauri-apps/api is a separate lazy chunk, not loaded into the browser.
  const handleExit = () => {
    if (IS_DESKTOP) void import('@tauri-apps/api/window').then(({ getCurrentWindow }) => getCurrentWindow().close())
    else window.close()
  }
  const handleResume = () => { document.querySelector('canvas')?.requestPointerLock() }
  // Ready in a match — the click grabs pointer lock (a gesture is needed) and marks the player ready (host↔client sync).
  const handleReady = () => {
    document.querySelector('canvas')?.requestPointerLock()
    gameApiRef.current?.requestReady()
  }

  const disposePool = () => { poolRef.current?.dispose(); poolRef.current = null }

  // PLAY → lobby. Default — the Matchmaking tab. both immediately brings up a host session (for the announcement);
  // client — a draft without networking until SEARCH.
  const handlePlay = () => {
    disposePool()
    poolRef.current = createMatchmakingPool()
    const sel: { map: MapFilter; durationMin: DurationFilter } = { map: [MAP_IDS[0]], durationMin: [MATCH_DURATIONS_MIN[0]] }
    setDraftSel(sel)
    setSearching(false)
    setLobbyTab(DEFAULT_LOBBY_TAB)
    setBotDifficulty(BOT_DEFAULT_DIFFICULTY)
    setBotName('')
    lobbyCodeRef.current = randomRoomCode()   // fix the lobby code (doesn't change when switching tabs)
    enterTabIdle(DEFAULT_LOBBY_TAB, sel)
    setScreen('lobby')
  }

  const handleBack = () => {
    setSearching(false)
    dmRef.current?.stop(); dmRef.current = null
    disposePool()
    forgetHosted()   // explicit exit to the menu → we no longer claim the host role for this code
    leaveRoom()
    setScreen('menu')
  }

  // --- lobby callbacks ---
  const onLobbySetMap = (m: MapFilter) => { if (sessionRef.current) sessionRef.current.setMap(m); else setDraftSel(s => ({ ...s, map: m })) }
  const onLobbySetDuration = (d: DurationFilter) => { if (sessionRef.current) sessionRef.current.setDuration(d); else setDraftSel(s => ({ ...s, durationMin: d })) }
  const onLobbySetBotDifficulty = (d: BotDifficulty) => { setBotDifficulty(d); sessionRef.current?.setBotDifficulty(d) }
  const onLobbySetBotName = (name: string) => { setBotName(name); sessionRef.current?.setBotName(name) }
  const onLobbyReady = () => sessionRef.current?.setLocalReady(true)

  // "vs Friend": symmetric rendezvous — both enter the same code and press SEARCH; selfId decides the role.
  const onLobbyFriendSearch = (code: string) => {
    const c = code.trim().toUpperCase()
    if (!c) return
    setSearching(true)
    dmRef.current?.stop(); dmRef.current = null
    poolRef.current?.withdraw(); poolRef.current?.cancel()
    enterRoomNegotiated(c, draftSel)
  }

  // Tab switch: reset transient state + rebuild the session for the tab's idle state. Always available.
  const onLobbySetTab = (tab: LobbyTab) => {
    if (tab === lobbyTab) return
    const sel = roomView ? { map: roomView.mapSel, durationMin: roomView.durationSel } : draftSel
    setSearching(false)
    qmRef.current?.stop(); qmRef.current = null
    dmRef.current?.stop(); dmRef.current = null
    poolRef.current?.withdraw(); poolRef.current?.cancel()
    setDraftSel(sel)
    setLobbyTab(tab)
    enterTabIdle(tab, sel)
  }

  // Steam matchmaking: quick-match over Steam public lobbies (no WebRTC → no cross-play).
  const startSteamQuickMatch = async () => {
    leaveRoom()
    setSearching(true)
    const token = ++steamEnterToken.current
    const qm = new SteamQuickMatch((net, role) => {
      if (token !== steamEnterToken.current) { net.leave(); return }
      setSearching(false)
      bindSession(net, role, '', draftSel)
    })
    qmRef.current = qm
    const ok = await qm.start()
    if (!ok && token === steamEnterToken.current) setSearching(false)   // no Steam
  }

  const onLobbySearch = () => {
    if (IS_DESKTOP) { void startSteamQuickMatch(); return }   // desktop Matchmaking = Steam quick-match
    const pool = poolRef.current
    if (!pool) return
    setSearching(true)
    const curMap = roomView?.mapSel ?? draftSel.map
    const curDur = roomView?.durationSel ?? draftSel.durationMin
    const dm = new DualMatchmaker({
      pool, mode: profile.searchRole, code: lobbyCodeRef.current,
      listing: { code: lobbyCodeRef.current, name: profile.name, color: profile.primaryColor, map: curMap, durationMin: curDur },
      filter: { map: curMap, durationMin: curDur },
    })
    // Join as a client with the ACTUALLY selected search parameters (in both mode the selection lives in the
    // host session, while draftSel stays default — otherwise the host resolves its choice against the client's
    // default: empty intersection → default map and time NaN/00:00).
    dm.onJoin(code => { setSearching(false); enterRoom(code, 'client', { map: curMap, durationMin: curDur }) })
    dmRef.current = dm
    dm.start()
  }
  const onLobbyStopSearch = () => {
    setSearching(false)
    steamEnterToken.current++   // discard any in-flight quick-match resolution
    qmRef.current?.stop(); qmRef.current = null
    dmRef.current?.stop(); dmRef.current = null
    poolRef.current?.withdraw(); poolRef.current?.cancel()
    if (lobbyTab === 'friend') enterTabIdle('friend', draftSel)   // friend: drop the rendezvous → draft
  }

  // Any live state without mouse capture is a pause (including when the first pointer lock failed: this case
  // used to be handled by a separate live "READY?" button, now there's one path — the overlay with "RESUME").
  const paused = screen === 'game' && !locked && hud.matchPhase === 'live'
  const lockCooldownLeft = Math.max(0, lockReadyAt - now)
  const resumeDisabled = lockCooldownLeft > 0

  // On the "join room" screen we show the reserve color (the host may take your primary — a preview of how
  // you'll most likely look). The color transition is smooth (lerp in MenuBackdrop).
  const menuPlayer = screen === 'appearance'
    ? appearancePreview
    : { color: profile.primaryColor, model: profile.ballModel, ringColor: profile.reserveColor, windupStyle: profile.windupStyle, respawnStyle: profile.respawnStyle, dashStyle: profile.dashStyle, shieldStyle: profile.shieldStyle, ballArt: profile.ballArt }

  // On "Appearance" the panel is pinned almost to the right edge (a small margin) — all the rest of the space
  // is given to the preview orb. The offset is computed from the MEASURED panel width and recomputed ONLY on
  // screen change/resize (no preview re-renders move the panel). The move is damped (MENU_ANIM_TAU).
  const [panelSlide, setPanelSlide] = useState(0)
  const panelRef = useDampedTranslateX(panelSlide)
  useEffect(() => {
    const compute = () => {
      if (screen !== 'appearance') { setPanelSlide(0); return }
      const w = panelRef.current?.offsetWidth ?? 0
      setPanelSlide(Math.max(0, Math.round((window.innerWidth - w) / 2 - APPEARANCE_PANEL_MARGIN_PX)))
    }
    compute()
    window.addEventListener('resize', compute)
    return () => window.removeEventListener('resize', compute)
  }, [screen, panelRef])

  // Blurred map background — only in the room, with fade in/out. Kept mounted for the duration of the exit fade;
  // we fix the last mapId so that on exit (roomView already null) the background doesn't flash to the default map.
  const showMap = screen === 'lobby'
  const mapMounted = useDelayedUnmount(showMap, MAP_FADE_MS)
  const [lastMapId, setLastMapId] = useState<MapId>(DEFAULT_MAP_ID)
  useEffect(() => {
    const m = roomView?.mapId ?? draftSel.map[0]
    if (m) setLastMapId(m)
  }, [roomView?.mapId, draftSel.map])

  // Lobby props: normalize RoomView (or a client draft without a session) into the Lobby shape.
  const buildLobby = () => {
    const v = roomView
    // Without a session: Steam "With friend" uses the intended role (host created the lobby / client joined an
    // invite) so the seat side is stable while the lobby forms; other tabs fall back to their idle host-ness.
    const isHost = v ? v.isHost
      : (IS_DESKTOP && lobbyTab === 'friend') ? steamFriendHosting
      : idleIsHost(lobbyTab)
    let me: LobbySlot = { name: profile.name, color: profile.primaryColor, ready: false }
    let opponent: (LobbySlot & { isBot: boolean }) | null = null
    if (v) {
      const myId = isHost ? HOST_ID : OPPONENT_ID
      const oppId = isHost ? OPPONENT_ID : HOST_ID
      const meE = v.roster.find(r => r.id === myId)
      if (meE) me = { name: meE.name, color: meE.color, ready: v.ready.includes(myId) }
      // the client sees the host ONLY after connecting (ASSIGN), otherwise its own host stub looks like a "match with yourself"
      const oppE = (isHost || v.connected) ? v.roster.find(r => r.id === oppId) : undefined
      opponent = oppE ? { name: oppE.name, color: oppE.color, ready: v.ready.includes(oppId), isBot: oppE.kind === 'bot' } : null
    }
    return {
      isHost, me, opponent,
      mapSel: v?.mapSel ?? draftSel.map,
      durationSel: v?.durationSel ?? draftSel.durationMin,
      searching,
      botDifficulty,
      botName,
      tab: lobbyTab, onSetTab: onLobbySetTab,
      onSetBotDifficulty: onLobbySetBotDifficulty, onSetBotName: onLobbySetBotName,
      onFriendSearch: onLobbyFriendSearch,
      onSetMap: onLobbySetMap, onSetDuration: onLobbySetDuration,
      onSearch: onLobbySearch, onStopSearch: onLobbyStopSearch, onReady: onLobbyReady,
      onBack: handleBack,
      steamFriendForming,
      onSteamInviteFriend: (id: string) => { void steamInviteToLobby(id) },
    }
  }
  const lobbyProps = screen === 'lobby' ? buildLobby() : null

  if (editorMode) {
    // The editor has no language-switch UI — onChange isn't needed
    return (
      <I18nProvider initial={initialLocale}>
        <Suspense fallback={<EditorLoading />}><EditorRoot /></Suspense>
      </I18nProvider>
    )
  }

  return (
    <I18nProvider
      initial={initialLocale}
      onChange={id => setProfile(p => {
        const next = { ...p, locale: id }
        saveProfile(next)
        return next
      })}
    >
    <SfxProvider engine={sfx}>
    <div style={{ width: '100vw', height: '100vh', position: 'relative', background: 'var(--bg)' }}>
      {screen !== 'game' && screen !== 'trailer' && mapMounted && <MapBackground mapId={lastMapId} show={showMap} />}
      {/* The outline glow is silenced via muted WITHOUT unmounting the composer (instant both ways):
          on "Appearance" — always, in other menus — per the "Glow in menu" setting. */}
      {/* part only on the "Appearance" screen: otherwise retention (e.g. shot/paint) keeps the orb rotated in the menu. */}
      {screen !== 'game' && screen !== 'trailer' && <MenuBackdrop mode={screen} player={menuPlayer} room={roomView} appearancePart={screen === 'appearance' ? appearancePreview.part : 'color'} analysis={profile.menuGlow ? audioAnalysis : undefined} glowMuted={screen === 'appearance' || !profile.menuGlow} onReady={handleMenuReady} sfx={sfx} />}
      {screen !== 'game' && screen !== 'trailer' && !IS_DESKTOP && resolveNetKind() === 'trystero' && <NetStatusChip />}
      {screen !== 'game' && screen !== 'trailer' && <VersionChip />}
      {/* A single persistent backing: it slides (isn't recreated) on screen change; inside — the screen content. */}
      {screen !== 'game' && screen !== 'trailer' && (
        <div className="screen">
          <div className="menu-panel" ref={panelRef}>
            {screen === 'menu' && <MainMenu onPlay={handlePlay} onAppearance={handleAppearance} onSettings={handleSettings} onExit={handleExit} />}
            {screen === 'settings' && (
              <Settings profile={profile} onChange={setProfile} onBack={() => setScreen('menu')} onWatchTrailer={() => setScreen('trailer')} section={settingsSection} onSectionChange={setSettingsSection} />
            )}
            {screen === 'appearance' && (
              <Appearance profile={profile} onChange={setProfile} onPreview={handlePreview} onShotPreview={handleShotPreview} onRespawnPreview={handleRespawnPreview} onDashPreview={handleDashPreview} onShieldPreview={handleShieldPreview} onBack={() => setScreen('menu')} />
            )}
            {screen === 'lobby' && lobbyProps && <Lobby {...lobbyProps} />}
          </div>
        </div>
      )}

      {screen === 'trailer' && (
        <TrailerScreen masterVolume={profile.volumeMaster} onDone={() => setScreen('settings')} />
      )}

      {screen === 'game' && gameNet && (
        <>
          <GameCanvas
            dispatch={dispatch}
            gameNet={gameNet}
            reserveColor={profile.reserveColor}
            defaultThirdPerson={profile.defaultView === 'tp'}
            apiRef={gameApiRef}
            sfxEngine={sfx}
            musicVolume={profile.volumeMaster * profile.volumeMusic}
            audioAnalysis={audioAnalysis}
          />
          {hud.matchPhase === 'ready' && (
            <ReadyOverlay
              roster={gameNet.netConfig.roster}
              localId={gameNet.netConfig.localId}
              role={gameNet.role}
              ready={hud.ready}
              onReady={handleReady}
            />
          )}
          {hud.matchPhase === 'countdown' && <CountdownOverlay n={hud.countdown} />}
          {/* Game HUD — only in live; during the countdown a clean screen (camera can turn) + the countdown itself. */}
          {locked && hud.matchPhase === 'live' && (
            <>
              <WindupOverlay windupProgress={hud.windupProgress} />
              <Crosshair beamProgress={hud.beamProgress} />
              <ScreenFlashes
                beamFlash={hud.beamFlash}
                playerHit={hud.playerHit}
                shieldBlock={hud.shieldBlock}
                botShieldHit={hud.botShieldHit}
                shieldVisible={hud.shieldVisible}
              />
              <ShieldBrackets
                shieldProgress={hud.shieldProgress}
                shieldVisible={hud.shieldVisible}
                shieldBlock={hud.shieldBlock}
              />
              <DashIndicator dashProgress={hud.dashProgress} />
              <StatsOverlay showFps={profile.showFps} showSpeed={profile.showSpeed} speed={hud.playerSpeed} />
              {hud.respawning && <RespawnOverlay progress={hud.respawning.progress} />}
              {profile.audioViz && <AudioBar analysis={audioAnalysis} />}
              <StreakBanner announce={hud.announce} />
              <OverheatVignette tier={hud.streaks[gameNet.netConfig.localId] ?? null} />
              <EffectDefs />
            </>
          )}
          {/* HUD bar: at the top in live (when the pointer is captured), at match end it transforms to center (final score). */}
          {((locked && hud.matchPhase === 'live') || hud.matchPhase === 'ended') && (
            <MatchHud scores={hud.scores} matchTime={hud.matchTime} roster={gameNet.netConfig.roster} localId={gameNet.netConfig.localId} streaks={hud.streaks} streakCounts={hud.streakCounts} ended={!!hud.matchResult} />
          )}
          {hud.matchResult && (
            <MatchEndedOverlay result={hud.matchResult} onExit={handleBack} />
          )}
        </>
      )}

      {paused && (
        <PauseMenu
          resumeDisabled={resumeDisabled}
          cooldownPct={(1 - lockCooldownLeft / POINTERLOCK_COOLDOWN) * 100}
          showExit={IS_DESKTOP}
          onResume={handleResume}
          onBack={handleBack}
          onExit={handleExit}
        />
      )}

      {showWarning && <EpilepsyWarning onDismiss={() => setShowWarning(false)} />}
    </div>
    </SfxProvider>
    </I18nProvider>
  )
}
