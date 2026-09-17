class_name MenuStage
## Who stands on the menu stage — port of web components/menuBalls computeBalls and menuStage STAGE_SPOTS: outside the
## lobby just you on the first spot; in the lobby every seated player on its seat's spot (a 1.8 m square: seats 0 / 1
## the Duel pair, 2 / 3 behind them), your own ball keeping the "player" key and your live profile ring.
## A ball spec: {color, model, ring, art}.

const EYE_HEIGHT := 1.7                 # web EYE_HEIGHT: spots are eye positions, like match spawns
const STAGE_SPOTS := [
	Vector3(0.0, EYE_HEIGHT, 0.0),       # seat 0 (the creator)
	Vector3(1.8, EYE_HEIGHT, 0.0),       # seat 1 (the classic opponent spot)
	Vector3(1.8, EYE_HEIGHT, -1.8),      # seat 2
	Vector3(0.0, EYE_HEIGHT, -1.8),      # seat 3
]
const PLAYER_KEY := "player"
const SLOT_KEY := "slot-%d"

## [{key, spec, spot}] for the screen: `player` is your spec, `roster` the lobby's seated entries.
static func balls(screen: String, player: Dictionary, roster: Array, local_id: int) -> Array:
	if screen == MenuCameraRig.SCREEN_LOBBY:
		# a client before ASSIGN: the local roster holds only its own placeholder in the host seat
		var self_id := local_id if roster.any(func(e): return e["id"] == local_id) else RoomModel.HOST_SLOT
		var out: Array = []
		for entry in roster:
			var id: int = entry["id"]
			if id < 0 or id >= STAGE_SPOTS.size():
				continue
			var spec := spec_of(entry)
			if id == self_id:
				spec["ring"] = player["ring"]
				if spec["art"] == "":
					spec["art"] = player["art"]
				out.append({"key": PLAYER_KEY, "spec": spec, "spot": STAGE_SPOTS[id]})
			else:
				out.append({"key": SLOT_KEY % id, "spec": spec, "spot": STAGE_SPOTS[id]})
		if not out.is_empty():
			return out
	return [{"key": PLAYER_KEY, "spec": player, "spot": STAGE_SPOTS[0]}]

## The ball look of a roster entry (web specOf: art and the reserve-colour ring included).
static func spec_of(entry: Dictionary) -> Dictionary:
	return {"color": entry["color"], "model": entry.get("ballModel", AppearanceConst.BALL_MODELS[0]),
		"ring": entry.get("reserveColor", entry["color"]), "art": entry.get("ballArt", "")}

## Your own spec from the profile.
static func profile_spec(profile: Dictionary) -> Dictionary:
	var color: String = profile.get("primaryColor", AppearanceConst.FALLBACK_EFFECT_COLOR)
	return {"color": color, "model": profile.get("ballModel", AppearanceConst.BALL_MODELS[0]),
		"ring": profile.get("reserveColor", color), "art": profile.get("ballArt", "")}
