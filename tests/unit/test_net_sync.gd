extends GutTest
## Two peers over a loopback pair sync owned players' positions to the other's non-owned copies.

func _player(id: int) -> Player:
	var p := Player.new()
	p.id = id
	return p

func test_owned_player_syncs_to_remote_copy() -> void:
	var pair := LoopbackNet.create_loopback_pair("A", "B")
	# Peer A owns player 0; peer B owns player 1. Both keep a copy of both.
	var a0 := _player(0)
	var a1 := _player(1)
	var b0 := _player(0)
	var b1 := _player(1)
	var sync_a := NetSync.new()
	sync_a.local_id = 0
	sync_a.add_player(a0, true)
	sync_a.add_player(a1, false)
	var sync_b := NetSync.new()
	sync_b.local_id = 1
	sync_b.add_player(b0, false)
	sync_b.add_player(b1, true)
	var _sess_a := NetSession.new(pair[0], sync_a)
	var _sess_b := NetSession.new(pair[1], sync_b)

	a0.body.position = Vector3(5, 1.7, 3)     # A moves its owned player
	_sess_a.after_update(1000.0)              # broadcast a snapshot (past the interval)

	assert_eq(b0.body.position, Vector3(5, 1.7, 3), "B's copy of player 0 got A's position")

func test_does_not_overwrite_own_player() -> void:
	var pair := LoopbackNet.create_loopback_pair("A", "B")
	var a0 := _player(0)
	var b0 := _player(0)
	var sync_a := NetSync.new(); sync_a.add_player(a0, true)
	var sync_b := NetSync.new(); sync_b.add_player(b0, true)   # B ALSO claims to own 0
	var _sa := NetSession.new(pair[0], sync_a)
	var _sb := NetSession.new(pair[1], sync_b)
	b0.body.position = Vector3(9, 1.7, 9)
	a0.body.position = Vector3(1, 1.7, 1)
	_sa.after_update(1000.0)
	assert_eq(b0.body.position, Vector3(9, 1.7, 9), "B keeps its own authoritative position")
