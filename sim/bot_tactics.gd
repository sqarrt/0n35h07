class_name BotTactics
## Bot evade decision. Ported from web controllers/botTactics.ts.

## ctx keys: kills, opp_kills, opp_winding_up (bool), has_los (bool), dist (float), evade_near (float).
## Ahead on score AND under threat -> bunny-hop evading pays off.
static func should_evade(ctx: Dictionary) -> bool:
	if int(ctx["kills"]) <= int(ctx["opp_kills"]):
		return false
	return (bool(ctx["opp_winding_up"]) and bool(ctx["has_los"])) or float(ctx["dist"]) < float(ctx["evade_near"])
