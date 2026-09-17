extends SceneTree
## Dev tool: a live Steam check on a machine with the Steam client running — the bridge autoload starts Steam, and after
## a few frames this prints whether Steam is up, our SteamID, persona name, friend count and any invite launch lobby,
## then reads the cloud profile blob and sets the menu Rich Presence (both harmless; no achievement is unlocked — an
## unlock can't be taken back on the real account).
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
	var blob := CloudProfileSync.parse_blob(bridge.call("cloud_read", CloudProfileSync.CLOUD_FILE))
	print("STEAM_SMOKE cloud_profile=%s updatedAt=%s presence=%s" % [not blob.is_empty(), blob.get("updatedAt", "-"),
		bridge.call("set_rich_presence", SteamPresence.STATUS_KEY, SteamPresence.TOKEN_MENU)])
	return true
