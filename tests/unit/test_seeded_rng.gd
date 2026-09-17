extends GutTest

func test_same_seed_same_sequence() -> void:
	var a := SeededRng.new("hello")
	var b := SeededRng.new("hello")
	for i in range(10):
		assert_eq(a.next(), b.next(), "same seed -> identical draw %d" % i)

func test_different_seed_differs() -> void:
	var a := SeededRng.new("alpha")
	var b := SeededRng.new("beta")
	var same := true
	for i in range(5):
		if a.next() != b.next():
			same = false
	assert_false(same, "different seeds produce different sequences")

func test_range_is_unit_interval() -> void:
	var r := SeededRng.new("x")
	for i in range(50):
		var v := r.next()
		assert_between(v, 0.0, 1.0, "value in [0,1)")
