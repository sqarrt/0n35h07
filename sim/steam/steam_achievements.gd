class_name SteamAchievements extends RefCounted
## Steam achievements for the local player — port of web src/steam/achievements.ts SteamAchievements: the match's events
## map to the Steamworks API names (defined in the partner portal) and each unlocks once for this sink (one per match,
## like web createAchievements). The simulation never sees the API strings: the unlock call is injected.

const ACH_CATALYST := "ACH_CATALYST"            # first frag of a match
const ACH_DOUBLE_KILL := "ACH_DOUBLE_KILL"
const ACH_TRIPLE_KILL := "ACH_TRIPLE_KILL"
const ACH_SINGULARITY := "ACH_SINGULARITY"
const ACH_DEFLECTOR := "ACH_DEFLECTOR"          # a perfect block
const ACH_FIRST_WIN := "ACH_FIRST_WIN"          # win a match
const ACH_UNTOUCHABLE := "ACH_UNTOUCHABLE"      # win without dying
const ACH_KILL := {"catalyst": ACH_CATALYST, "double": ACH_DOUBLE_KILL, "triple": ACH_TRIPLE_KILL,
	"singularity": ACH_SINGULARITY}             # keyed by Streak.announce_kind

var _unlock: Callable
var _unlocked := {}

## `unlock`: (api_name: String) -> void — the Steam bridge in the game, a recorder in tests.
func _init(unlock: Callable) -> void:
	_unlock = unlock

## The local player landed a kill: `streak` is their streak, `first_blood` the match's first frag.
func on_kill(streak: int, first_blood: bool) -> void:
	var kind := Streak.announce_kind(streak, first_blood)
	if kind != "":
		_fire(ACH_KILL[kind])

func on_perfect_block() -> void:
	_fire(ACH_DEFLECTOR)

## The match ended: `won` for the local player, `flawless` when they never died.
func on_match_end(won: bool, flawless: bool) -> void:
	if not won:
		return
	_fire(ACH_FIRST_WIN)
	if flawless:
		_fire(ACH_UNTOUCHABLE)

func _fire(api_name: String) -> void:
	if _unlocked.has(api_name):
		return
	_unlocked[api_name] = true
	_unlock.call(api_name)
