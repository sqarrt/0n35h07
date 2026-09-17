extends GutTest
## RadioQueue — web App playQueueAt / onTrackEnd: the start wraps into the queue, prev and next wrap round both ends.

const TRACKS := [{"name": "A"}, {"name": "B"}, {"name": "C"}]

func test_the_start_and_steps_wrap_round() -> void:
	var queue := RadioQueue.new()
	assert_true(queue.is_empty())
	assert_eq(queue.step(1), {}, "no queue: nothing to play")
	queue.set_tracks(TRACKS, 4)
	assert_eq(queue.current()["name"], "B", "4 of 3 is the second")
	assert_eq(queue.step(1)["name"], "C")
	assert_eq(queue.step(1)["name"], "A", "the end loops to the start")
	assert_eq(queue.step(-1)["name"], "C", "prev from the first is the last")

func test_the_queue_is_a_copy() -> void:
	var tracks := TRACKS.duplicate()
	var queue := RadioQueue.new()
	queue.set_tracks(tracks, 0)
	tracks.clear()
	assert_eq(queue.tracks.size(), 3)
