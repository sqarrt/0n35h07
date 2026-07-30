extends GutTest

func test_broadcast_reaches_linked_peers() -> void:
	var pair := LoopbackNet.create_loopback_pair("A", "B")
	var got := []
	pair[1].on("snapshot", func(payload, from): got.append([payload, from]))
	pair[0].broadcast("snapshot", {"x": 1})
	assert_eq(got.size(), 1, "B received A's broadcast")
	assert_eq(got[0][1], "A", "from is the sender")
	assert_eq(got[0][0]["x"], 1)

func test_send_is_directed() -> void:
	var hub := LoopbackNet.create_loopback_hub(["A", "B", "C"])
	var b_got := [0]   # array counter — GDScript lambdas capture ints by value
	var c_got := [0]
	hub[1].on("event", func(_p, _f): b_got[0] += 1)
	hub[2].on("event", func(_p, _f): c_got[0] += 1)
	hub[0].send("B", "event", {})
	assert_eq(b_got[0], 1, "only B got the directed send")
	assert_eq(c_got[0], 0, "C did not")

func test_peers_lists_links() -> void:
	var pair := LoopbackNet.create_loopback_pair("A", "B")
	assert_eq(pair[0].peers(), ["B"])
