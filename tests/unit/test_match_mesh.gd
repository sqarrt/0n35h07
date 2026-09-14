extends GutTest
## A networked match (web Match on the mesh) between two peers on a loopback pair: ownership and the creator, the
## countdown stamped by the creator only, remote players following snapshots in the past, verdicts attributed to the
## victim's owner, remote shots and respawns, claims on remote victims, and a peer leaving.

const PLAYER := preload("res://scenes/player.tscn")
const SCREEN := Vector2i(64, 64)
const HOST := "A"
const GUEST := "B"
const STRANGER := "C"
const OWNERS := {0: HOST, 1: GUEST}
const NOW_MS := 1000.0
const LATER_MS := NOW_MS + NetConst.NET_INTERP_DELAY_MS * 3.0
const MOVED := Vector3(3.0, 1.7, -2.0)
const RESPAWN_AT := [1.0, 1.7, 1.0]
const BEAM_END := [0.0, 1.0, -5.0]
const HIT_POINT := Vector3(0.0, 1.0, -3.0)
const DT := 1.0 / 60.0

## A weapon that has just fired at player 1 (MatchRules reads fire_seq and outcome only).
class FiredWeapon extends RefCounted:
	var fire_seq := 1
	var outcome := {"end": Vector3.FORWARD, "hit_point": HIT_POINT, "hit_entity_id": 1}
	func set_cooldown_scale(_scale: float) -> void:   # the match's overheat pass touches every weapon
		pass
	func interrupt() -> void:
		pass

var _now := NOW_MS

func before_each() -> void:
	_now = NOW_MS

func _peer(peer: String, local: int, net) -> Dictionary:
	var viewport := SubViewport.new()
	viewport.size = SCREEN
	viewport.own_world_3d = true
	add_child_autofree(viewport)
	var node := MatchNode.new()
	node.local_id = local
	node.clock_ms = func() -> float: return _now
	node.configure_mesh(OWNERS, peer)
	viewport.add_child(node)
	var pnodes := {}
	for id in OWNERS:
		var pnode: PlayerNode = PLAYER.instantiate()
		pnode.player.id = id
		pnode.replay = not node.owns(id)                 # a remote player is only shown
		viewport.add_child(pnode)
		pnode.get_node("Camera3D").free()
		node.add_entity(pnode, id)
		pnodes[id] = pnode
	return {"match": node, "players": pnodes, "session": NetSession.new(net, node)}

func _pair() -> Array:
	var nets := LoopbackNet.create_loopback_pair(HOST, GUEST)
	return [_peer(HOST, 0, nets[0]), _peer(GUEST, 1, nets[1])]

func test_ownership_and_the_creator() -> void:
	var peers := _pair()
	var host: MatchNode = peers[0]["match"]
	var guest: MatchNode = peers[1]["match"]
	assert_true(host.owns(0))
	assert_false(host.owns(1))
	assert_true(host.i_am_creator(), "the owner of seat 0")
	assert_false(guest.i_am_creator())
	assert_eq(guest.creator_peer(), HOST)

func test_only_the_creator_stamps_the_countdown() -> void:
	var peers := _pair()
	var host: MatchNode = peers[0]["match"]
	var guest: MatchNode = peers[1]["match"]
	assert_true(host.mark_ready(0))
	(peers[0]["session"] as NetSession).after_update(NOW_MS)
	assert_eq(guest.ready_ids(), [0], "our readiness goes out as an event")
	assert_true(guest.mark_ready(1))
	assert_true(guest.is_ready_phase(), "everyone is ready, but the guest waits for the creator's stamp")
	(peers[1]["session"] as NetSession).after_update(NOW_MS)
	assert_eq(host.countdown_label(), "3", "the creator stamps the countdown")
	(peers[0]["session"] as NetSession).after_update(NOW_MS)
	assert_eq(guest.countdown_label(), "3", "and ships it")

func test_remote_players_follow_snapshots_in_the_past() -> void:
	var peers := _pair()
	var guest: MatchNode = peers[1]["match"]
	(peers[0]["players"][0] as PlayerNode).place_at(MOVED)
	(peers[0]["session"] as NetSession).after_update(NOW_MS)
	_now = LATER_MS
	guest._place_remotes()
	assert_true((peers[1]["players"][0] as PlayerNode).global_position.is_equal_approx(MOVED))
	assert_false((peers[1]["players"][1] as PlayerNode).global_position.is_equal_approx(MOVED), "ours never follow")

func test_verdicts_come_from_the_victims_owner() -> void:
	var peers := _pair()
	var host: MatchNode = peers[0]["match"]
	watch_signals(host)
	host.apply_peer_event(STRANGER, {"t": "kill", "shooter": 0, "victim": 1})
	assert_eq(host.score_of(0), 0, "only the victim's owner judges")
	host.apply_peer_event(GUEST, {"t": "kill", "shooter": 0, "victim": 1})
	assert_eq(host.score_of(0), 1)
	assert_false((peers[0]["players"][1] as PlayerNode).player.alive)
	assert_signal_emitted_with_parameters(host, "frag", [0, 1, 1, true])

func test_remote_shots_and_respawns_show_up() -> void:
	var peers := _pair()
	var guest: MatchNode = peers[1]["match"]
	watch_signals(guest)
	guest.apply_peer_event(HOST, {"t": "fired", "id": 0, "end": BEAM_END, "hit_point": null, "hit": -1})
	assert_signal_emitted_with_parameters(guest, "fired", [0])
	guest.apply_peer_event(GUEST, {"t": "fired", "id": 0, "end": BEAM_END, "hit_point": null, "hit": -1})
	assert_signal_emit_count(guest, "fired", 1, "a peer can't fire for a player it doesn't own")
	guest.apply_peer_event(HOST, {"t": "respawn", "id": 0, "pos": RESPAWN_AT})
	assert_true((peers[1]["players"][0] as PlayerNode).global_position.is_equal_approx(
		Vector3(RESPAWN_AT[0], RESPAWN_AT[1], RESPAWN_AT[2])))

func test_hits_on_remote_victims_become_claims() -> void:
	var rules := MatchRules.new()
	var shooter := Player.new()
	shooter.id = 0
	shooter.team = 0
	var victim := Player.new()
	victim.id = 1
	victim.team = 1
	rules.add_player(shooter)
	rules.add_player(victim)
	shooter.weapon = FiredWeapon.new()
	rules.owns = func(id: int) -> bool: return id == 0
	rules.resolve(DT)
	assert_eq(rules.events.size(), 1, "our shot is still ours to show")
	assert_eq(rules.claims, [{"shooter": 0, "hit_id": 1, "point": [HIT_POINT.x, HIT_POINT.y, HIT_POINT.z]}])
	assert_true(victim.alive, "the victim's owner decides")

func test_our_hit_on_a_remote_victim_is_predicted() -> void:
	var peers := _pair()
	var host: MatchNode = peers[0]["match"]
	(peers[0]["players"][0] as PlayerNode).player.weapon = FiredWeapon.new()
	host._physics_process(DT)
	var victim: Player = (peers[0]["players"][1] as PlayerNode).player
	assert_false(victim.alive, "the shooter sees the kill before the owner's verdict (web predictOpponentDeath)")
	assert_eq(host.drain_claims().size(), 1, "and still asks the victim's owner")

func test_a_departed_peer_ends_the_duel() -> void:
	var peers := _pair()
	var host: MatchNode = peers[0]["match"]
	host.handle_peer_left(GUEST)
	assert_false((peers[0]["players"][1] as PlayerNode).visible)
	assert_eq(host.players().size(), 1, "bots stop targeting the departed")
	assert_true(host.is_ended(), "one team left")
