class_name SteamNetWiring
## A SteamNet on the Steam bridge — web buildSteamNet: our SteamID, sends and leaving go through the bridge, every bridge
## event feeds the transport, and leaving the transport stops listening. Null without Steam.

static func wire(bridge) -> SteamNet:
	var self_id: String = bridge.self_id()
	if self_id == "":
		return null
	var net := SteamNet.new(self_id, func(to: String, data: String) -> void: bridge.send(to, data),
		func() -> void: bridge.leave_lobby())
	var feed := net.handle_event
	bridge.net_event.connect(feed)
	net.set_unlisten(func() -> void:
		if bridge.net_event.is_connected(feed):
			bridge.net_event.disconnect(feed))
	return net
