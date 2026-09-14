extends SceneTree
## Dev tool: a live Steam check on a machine with the Steam client running — the bridge autoload starts Steam, and after
## a few frames this prints whether Steam is up, our SteamID, persona name, friend count and any invite launch lobby.
##   --path . -s tools/steam_smoke.gd

const SETTLE_FRAMES := 30                      # callbacks and the relay bootstrap get a moment

var _frames := 0

func _process(_delta: float) -> bool:
	_frames += 1
	if _frames < SETTLE_FRAMES:
		return false
	var bridge := root.get_node_or_null("SteamBridge")   # autoload node (not a compile-time global here)
	if bridge == null:
		print("STEAM_SMOKE no bridge autoload")
		return true
	print("STEAM_SMOKE available=%s self=%s name=%s friends=%d launch_lobby=%s" % [bridge.call("available"),
		bridge.call("self_id"), bridge.call("persona_name"), (bridge.call("friends") as Array).size(),
		bridge.call("take_launch_connect")])
	return true
