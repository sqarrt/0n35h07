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

func test_the_bounty_follows_the_owners_streak_not_each_peers_own() -> void:
	# Verdicts from different owners reach peers in different orders, so a peer can hold a stale streak for the victim.
	# The bounty must still be the owner's word, or the scores part by a frag and never come back (seen live in 2v2).
	_syncs[VICTIM].players[VICTIM].streak = Streak.STREAK_TRIPLE
	_syncs[SHOOTER].players[VICTIM].streak = 0        # our copy has not caught up with the victim's streak
	_syncs[OBSERVER].players[VICTIM].streak = 1
	_deliver_shot()
	_sessions[OBSERVER].after_update(SEND_TIME_MS)
	for sync in _syncs:
		assert_eq(sync.players[SHOOTER].kills, 2, "every peer pays the bounty the victim's owner saw")

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

# --- kill prediction (web Match.predictOpponentDeath, tests/unit/Match.predictedKill + mesh.deathProtocol) ---

const PREDICT_AT_MS := 1000.0
const WITHIN_GRACE_MS := PREDICT_AT_MS + NetConst.NET_PREDICT_KILL_MS * 0.5
const AFTER_GRACE_MS := PREDICT_AT_MS + NetConst.NET_PREDICT_KILL_MS * 2.0

var _now := PREDICT_AT_MS

func _predict() -> Player:
	_now = PREDICT_AT_MS
	_syncs[SHOOTER].clock_ms = func() -> float: return _now
	_syncs[SHOOTER].predict_death(VICTIM)
	return _syncs[SHOOTER].players[VICTIM]

func test_a_predicted_death_shows_at_once() -> void:
	var victim := _predict()
	assert_false(victim.alive)
	assert_true(victim.respawning, "a ghost: its hitbox is off")

func test_the_owners_kill_confirms_the_prediction() -> void:
	_predict()
	_deliver_shot()
	for sync in _syncs:
		assert_eq(sync.players[VICTIM].deaths, 1, "one death, not two")
		assert_eq(sync.players[SHOOTER].kills, 1)
	assert_eq(_syncs[SHOOTER].predicted_kill, {})

func test_a_block_reverts_the_prediction() -> void:
	_syncs[VICTIM].players[VICTIM].activate_shield()
	var victim := _predict()
	_deliver_shot()
	assert_true(victim.alive, "the owner's shield won: the victim is back and hittable")
	assert_false(victim.respawning)
	assert_eq(victim.deaths, 0)

func test_alive_snapshots_wait_out_the_grace_then_revive() -> void:
	var victim := _predict()
	_now = WITHIN_GRACE_MS
	_sessions[VICTIM].after_update(SEND_TIME_MS)
	assert_false(victim.alive, "a snapshot sent before the claim arrived doesn't revive it")
	_now = AFTER_GRACE_MS
	_sessions[VICTIM].after_update(SEND_TIME_MS * 2.0)
	assert_true(victim.alive, "no verdict within the grace: the claim was lost")
	assert_eq(victim.deaths, 0)

func test_a_visibly_shielded_victim_is_not_predicted() -> void:
	var copy: Player = _syncs[SHOOTER].players[VICTIM]
	copy.remote = RemoteState.new()
	copy.remote.shield = true
	_syncs[SHOOTER].predict_death(VICTIM)
	assert_true(copy.alive, "its owner will judge a block")

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
	assert_eq(sync.drain_events(), [{"t": "kill", "shooter": SHOOTER, "victim": VICTIM, "seq": 0, "broken": 0}],
		"the verdict carries the shot's number (0 here: the claim was hand-made) and the streak it broke")

func test_the_grace_runs_out_even_if_the_owner_goes_quiet() -> void:
	# The grace used to be looked at only when the owner's next snapshot arrived: a peer that stalled left its player
	# an unhittable ghost on our screen for the rest of the match.
	var victim := _predict()
	_syncs[SHOOTER].tick_prediction()
	assert_false(victim.alive, "still inside the grace")
	_now = AFTER_GRACE_MS
	_syncs[SHOOTER].tick_prediction()
	assert_true(victim.alive, "no verdict and no snapshots: the victim comes back")
	assert_true(_syncs[SHOOTER].predicted_kill.is_empty())

func test_a_snapshot_that_overtook_a_newer_one_is_dropped() -> void:
	var owner: NetSync = _syncs[VICTIM]
	var watcher: NetSync = _syncs[OBSERVER]
	owner.players[VICTIM].body.position = Vector3.ZERO
	var older := owner.serialize_snapshot()                # sent first, and overtaken on the way
	owner.players[VICTIM].body.position = Vector3(5.0, MoveConst.EYE_HEIGHT, 0.0)
	var newer := owner.serialize_snapshot()
	watcher.apply_peer_snapshot(PEERS[VICTIM], newer)
	watcher.apply_peer_snapshot(PEERS[VICTIM], older)
	assert_almost_eq(watcher.players[VICTIM].position().x, 5.0, 0.01, "a stale snapshot would rewind the player")

func test_a_claim_from_a_shooter_that_cannot_fire_is_dropped() -> void:
	var owner: NetSync = _syncs[VICTIM]
	owner.players[SHOOTER].alive = false
	assert_eq(owner.judge_claim(PEERS[SHOOTER], _claim()), {}, "a dead player has no beam")
	assert_true(owner.players[VICTIM].alive)
	owner.players[SHOOTER].alive = true
	owner.players[SHOOTER].frozen = true
	assert_eq(owner.judge_claim(PEERS[SHOOTER], _claim()), {}, "nor a frozen one")
	assert_true(owner.players[VICTIM].alive)

func test_a_shot_that_left_before_its_shooter_died_still_counts() -> void:
	# Seen live in 2v2: a player fires and dies a moment later; the news of the death overtakes the claim, and the
	# honest hit was thrown away — the shooter watched its own predicted kill come back to life.
	var owner: NetSync = _syncs[VICTIM]
	var clock := [0.0]                       # a lambda captures by value, so the clock lives in something shared
	owner.clock_ms = func() -> float: return clock[0]
	owner.apply_peer_event(PEERS[SHOOTER], {"t": "kill", "shooter": OBSERVER, "victim": SHOOTER})
	assert_false(owner.players[SHOOTER].alive, "its owner told us it died")
	clock[0] = NetSync.CLAIM_DEAD_SLACK_MS
	assert_ne(owner.judge_claim(PEERS[SHOOTER], _claim()), {}, "the shot was already on its way")
	assert_false(owner.players[VICTIM].alive)

func test_our_own_guess_does_not_silence_the_shooters_claim() -> void:
	# Seen live in FFA: we shoot someone and show them dead at once (a prediction, not a verdict); their shot at us,
	# fired a moment earlier, arrived and was thrown away as "a dead player has no beam".
	var owner: NetSync = _syncs[VICTIM]
	owner.predict_death(SHOOTER)
	assert_false(owner.players[SHOOTER].alive, "our screen shows them dead")
	assert_ne(owner.judge_claim(PEERS[SHOOTER], _claim()), {}, "but only we think so: their shot still counts")

func test_a_claim_from_a_long_dead_shooter_is_still_dropped() -> void:
	var owner: NetSync = _syncs[VICTIM]
	var clock := [0.0]
	owner.clock_ms = func() -> float: return clock[0]
	owner.apply_peer_event(PEERS[SHOOTER], {"t": "kill", "shooter": OBSERVER, "victim": SHOOTER})
	clock[0] = NetSync.CLAIM_DEAD_SLACK_MS + 1.0
	assert_eq(owner.judge_claim(PEERS[SHOOTER], _claim()), {}, "a dead player has no beam")
	assert_true(owner.players[VICTIM].alive)

func test_claims_cannot_outrun_the_weapon() -> void:
	var owner: NetSync = _syncs[VICTIM]
	_now = PREDICT_AT_MS
	owner.clock_ms = func() -> float: return _now
	assert_ne(owner.judge_claim(PEERS[SHOOTER], _claim()), {}, "the first shot is judged")
	owner.players[VICTIM].revive_from_false_prediction()
	assert_eq(owner.judge_claim(PEERS[SHOOTER], _claim()), {}, "a second claim inside the cooldown is not a shot")
	_now += CombatConst.BEAM_COOLDOWN_MS
	assert_ne(owner.judge_claim(PEERS[SHOOTER], _claim()), {}, "once the beam could fire again, it is judged")

func test_a_ghost_carries_its_time_left_to_the_other_screens() -> void:
	var owner: NetSync = _syncs[VICTIM]
	var watcher: NetSync = _syncs[OBSERVER]
	owner.judge_claim(PEERS[SHOOTER], _claim())
	assert_true(owner.players[VICTIM].respawning)
	watcher.apply_peer_snapshot(PEERS[VICTIM], owner.serialize_snapshot())
	assert_gt(watcher.players[VICTIM].respawn_timer, 0.0, "the remote ghost counts down too")
