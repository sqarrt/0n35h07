extends GutTest

func test_empty_returns_null() -> void:
	assert_null(InterpBuffer.new().sample(0.0))

func test_interpolates_between_samples() -> void:
	var b := InterpBuffer.new()
	b.push(0.0, 0, 0, 0)
	b.push(100.0, 10, 0, 0)
	var v = b.sample(50.0)
	assert_almost_eq(v.x, 5.0, 1e-4, "halfway -> midpoint")

func test_clamps_to_latest_when_ahead() -> void:
	var b := InterpBuffer.new()
	b.push(0.0, 0, 0, 0)
	b.push(100.0, 10, 0, 0)
	assert_eq(b.sample(999.0), Vector3(10, 0, 0), "ahead of newest -> newest (no extrapolation)")

func test_capacity_drops_oldest() -> void:
	var b := InterpBuffer.new(2)
	b.push(0.0, 0, 0, 0)
	b.push(1.0, 1, 0, 0)
	b.push(2.0, 2, 0, 0)   # drops t=0
	assert_eq(b.sample(0.0), Vector3(1, 0, 0), "oldest dropped -> clamps to t=1")
