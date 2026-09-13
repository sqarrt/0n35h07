extends GutTest
## Victim-judged combat parity over a real, synchronous three-peer loopback mesh.

const PEERS := ["A", "B", "C"]
const SHOOTER := 0
const VICTIM := 1
const OBSERVER := 2
const SEND_TIME_MS := 1000.0
const OUT_OF_RANGE_MARGIN := 1.0

var _syncs: Array = []
var _sessions: Array = []
var _nets: Array = []

func before_each() -> void:
	_nets = LoopbackNet.create_loopback_hub(PEERS)
	for local in range(PEERS.size()):
		var sync := NetSync.new()
		sync.local_id = local
		for id in range(PEERS.size()):
			var p := Player.new()
			p.id = id
			p.team = id
			p.set_shield(Shield.new())
			sync.owner_of[id] = PEERS[id]
			sync.add_player(p, id == local)
		_syncs.append(sync)
		_sessions.append(NetSession.new(_nets[local], sync))

func after_each() -> void:
	for session in _sessions:
		session.dispose()
	_sessions.clear()
	_syncs.clear()
	_nets.clear()

func _claim() -> Dictionary:
	return {"shooter": SHOOTER, "hit_id": VICTIM, "point": null}

func _deliver_shot() -> void:
	_syncs[SHOOTER].queue_or_judge(_claim())
	_sessions[SHOOTER].after_update(SEND_TIME_MS)
	_sessions[VICTIM].after_update(SEND_TIME_MS)

func test_victim_verdict_scores_on_every_peer() -> void:
	_deliver_shot()
	for sync in _syncs:
		assert_false(sync.players[VICTIM].alive)
		assert_true(sync.players[VICTIM].respawning)
		assert_eq(sync.players[VICTIM].deaths, 1)
		assert_eq(sync.players[SHOOTER].kills, 1)
		assert_eq(sync.players[SHOOTER].streak, 1)

func test_victims_local_shield_wins_over_shooters_unshielded_copy() -> void:
	_syncs[VICTIM].players[VICTIM].activate_shield()
	_deliver_shot()
	for sync in _syncs:
		assert_true(sync.players[VICTIM].alive)
		assert_eq(sync.players[SHOOTER].kills, 0)

func test_perfect_block_resets_victims_dash_cooldown() -> void:
	var victim: Player = _syncs[VICTIM].players[VICTIM]
	assert_true(victim.dash(Vector3.RIGHT))
	victim.activate_shield()
	_deliver_shot()
	assert_eq(victim.dash_progress(), 1.0)

func test_bounty_is_derived_on_every_peer() -> void:
	for sync in _syncs:
		sync.players[VICTIM].streak = Streak.STREAK_TRIPLE
	_deliver_shot()
	for sync in _syncs:
		assert_eq(sync.players[SHOOTER].kills, 2)
		assert_eq(sync.players[SHOOTER].streak, 1)
		assert_eq(sync.players[VICTIM].streak, 0)

func test_sender_must_own_shooter() -> void:
	_nets[OBSERVER].send(PEERS[VICTIM], "hit", _claim())
	assert_true(_syncs[VICTIM].players[VICTIM].alive)
	assert_eq(_syncs[VICTIM].drain_events(), [])

func test_claim_is_addressed_only_to_victims_owner() -> void:
	_syncs[SHOOTER].queue_or_judge(_claim())
	assert_eq(_syncs[SHOOTER].drain_claims(), [{"to": PEERS[VICTIM], "claim": _claim()}])
	assert_eq(_syncs[SHOOTER].drain_claims(), [])
	assert_true(_syncs[SHOOTER].players[VICTIM].alive)

func test_unknown_victim_is_not_queued() -> void:
	var claim := _claim()
	claim["hit_id"] = PEERS.size()
	_syncs[SHOOTER].queue_or_judge(claim)
	assert_eq(_syncs[SHOOTER].drain_claims(), [])

func test_null_target_is_a_miss_not_player_zero() -> void:
	var claim := {"shooter": VICTIM, "hit_id": null}
	_syncs[VICTIM].queue_or_judge(claim)
	_syncs[SHOOTER].judge_claim(PEERS[VICTIM], claim)
	assert_eq(_syncs[VICTIM].drain_claims(), [])
	assert_true(_syncs[SHOOTER].players[SHOOTER].alive)

func test_cannot_queue_another_peers_shot() -> void:
	_syncs[OBSERVER].queue_or_judge(_claim())
	assert_eq(_syncs[OBSERVER].drain_claims(), [])

func test_out_of_range_claim_is_dropped() -> void:
	var claim := _claim()
	claim["point"] = [CombatConst.AIM_RANGE + OUT_OF_RANGE_MARGIN, 0.0, 0.0]
	_syncs[VICTIM].judge_claim(PEERS[SHOOTER], claim)
	assert_true(_syncs[VICTIM].players[VICTIM].alive)
	assert_eq(_syncs[VICTIM].drain_events(), [])

func test_range_falls_back_to_victim_position() -> void:
	_syncs[VICTIM].players[VICTIM].body.position = Vector3.RIGHT * (CombatConst.AIM_RANGE + OUT_OF_RANGE_MARGIN)
	_syncs[VICTIM].judge_claim(PEERS[SHOOTER], _claim())
	assert_true(_syncs[VICTIM].players[VICTIM].alive)

func test_duplicate_claim_does_not_double_score_dead_victim() -> void:
	_deliver_shot()
	_deliver_shot()
	for sync in _syncs:
		assert_eq(sync.players[SHOOTER].kills, 1)
		assert_eq(sync.players[VICTIM].deaths, 1)

func test_teammate_is_not_harmed() -> void:
	_syncs[VICTIM].players[VICTIM].team = SHOOTER
	_deliver_shot()
	assert_true(_syncs[VICTIM].players[VICTIM].alive)

func test_forged_verdict_is_dropped() -> void:
	_nets[OBSERVER].broadcast("event", {"t": "kill", "shooter": SHOOTER, "victim": VICTIM})
	for sync in _syncs:
		assert_true(sync.players[VICTIM].alive)
		assert_eq(sync.players[SHOOTER].kills, 0)

func test_forged_snapshot_cannot_revive_a_victim() -> void:
	_deliver_shot()
	var snapshot: Dictionary = _syncs[VICTIM].serialize_snapshot()
	snapshot["players"][0]["alive"] = true
	snapshot["players"][0]["respawning"] = false
	_nets[OBSERVER].broadcast("snapshot", snapshot)
	assert_false(_syncs[SHOOTER].players[VICTIM].alive)

func test_local_bot_victim_is_judged_without_network() -> void:
	var sync := NetSync.new()
	for id in [SHOOTER, VICTIM]:
		var p := Player.new()
		p.id = id
		p.team = id
		sync.add_player(p, true)
	sync.queue_or_judge(_claim())
	assert_false(sync.players[VICTIM].alive)
	assert_eq(sync.players[SHOOTER].kills, 1)
	assert_eq(sync.drain_claims(), [])
	assert_eq(sync.drain_events(), [{"t": "kill", "shooter": SHOOTER, "victim": VICTIM}])
