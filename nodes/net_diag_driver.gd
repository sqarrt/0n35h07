class_name NetDiagDriver extends Node
## The network test's hands (NetDiag), attached to the menu only when the run asks for it. Driving the real menu with
## synthetic mouse clicks proved both brittle and rude — it types into whatever else is open — so the stand works the
## game's own controls instead: open PLAY, set the mode, fill the empty seats with bots (the creator owns them), and
## confirm. Everything else about the run is the game as a player meets it: a real lobby on a real transport, the
## handshake, the arena, and the pilot that plays the window (NetDiagPilot).

const MODE_FLAG := "--netdiag-mode"       # duel / battle / war; the creator's choice, guests follow
const BOTS_FLAG := "--netdiag-bots"       # how many empty seats the creator fills
const SEATS_FLAG := "--netdiag-seats"     # how many seats must be taken before the creator confirms
const SEATS_WAIT_S := 30.0                # after this the creator confirms anyway, so a run never hangs silently
const OPEN_DELAY_S := 1.5                 # let the menu finish coming up before pressing PLAY
const SETTLE_S := 0.4                     # between steps, so each one lands on a menu that has caught up
const MODES := {"duel": GameModes.DUEL, "battle": GameModes.BATTLE, "war": GameModes.WAR}

var _menu: MainMenu
var _args := PackedStringArray()
var _left := OPEN_DELAY_S
var _step := 0
var _guest := false                       # launched to join someone's lobby: the menu does that by itself
var _waited := 0.0                        # how long the creator has been waiting for the other windows

func setup(menu: MainMenu, args: PackedStringArray) -> void:
	_menu = menu
	_args = args
	_guest = SteamBridge.parse_connect_lobby(" ".join(args)) != ""

func _process(delta: float) -> void:
	_left -= delta
	if _left > 0.0:
		return
	_left = SETTLE_S
	if _guest:
		_join()          # the menu is already taking us into the creator's lobby: wait for our seat, then confirm
		return
	match _step:
		0:
			_menu.open_lobby()
			GameLog.log("netdiag", "play", {"mode": _value(MODE_FLAG, ""), "bots": _value(BOTS_FLAG, "0")})
		1:
			_choose_mode()
		2:
			_fill_with_bots()
		3:
			if not _seats_taken():
				return   # every window takes its seat before the match starts, as a lobby waits for its players
			_confirm()
			set_process(false)
	_step += 1

## A guest confirms as soon as the creator has seated it.
func _join() -> void:
	var room := Game.room
	if room == null or room.local_player_id == RoomSession.UNASSIGNED:
		return
	_confirm()
	set_process(false)

## The creator picks the mode the run asks for; a guest has no say and the call does nothing there.
func _choose_mode() -> void:
	var asked := _value(MODE_FLAG, "")
	if MODES.has(asked) and Game.room != null:
		Game.room.set_mode(MODES[asked])

## Bots fill the seats no window is going to take, so Battle and War can run with two windows.
func _fill_with_bots() -> void:
	var wanted := int(_value(BOTS_FLAG, "0"))
	var room := Game.room
	if room == null or not room.is_host():
		return
	for i in wanted:
		var free: int = room.slots.find(null)
		if free < 0:
			return
		room.add_bot(free)

func _confirm() -> void:
	if Game.room != null:
		Game.room.set_local_ready(true)
		GameLog.log("netdiag", "ready", {"id": Game.room.local_player_id, "peer": Game.room.net.self_id})

## Whether the lobby holds as many players as the run asked for — the creator waits for them, but not forever.
func _seats_taken() -> bool:
	var wanted := int(_value(SEATS_FLAG, "0"))
	var room := Game.room
	if wanted <= 0 or room == null:
		return true
	_waited += SETTLE_S
	var taken := 0
	for slot in room.slots:
		if slot != null:
			taken += 1
	if taken >= wanted:
		GameLog.log("netdiag", "seated", {"taken": taken, "waited": _waited})
		return true
	if _waited >= SEATS_WAIT_S:
		GameLog.warn("netdiag", "seats_timeout", {"taken": taken, "wanted": wanted})
		return true
	return false

## The value after `flag` on the command line, or `fallback`.
func _value(flag: String, fallback: String) -> String:
	var at := _args.find(flag)
	return _args[at + 1] if at >= 0 and at + 1 < _args.size() else fallback
