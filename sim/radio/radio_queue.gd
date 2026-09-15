class_name RadioQueue extends RefCounted
## The library's play queue — web App radioQueueRef ('fav' mode): a folder's baked tracks played in order, prev and
## next wrapping round both ends, and a finished track moving on to the next (looping).

var tracks: Array = []
var index := 0

## A new queue from `start` (wrapped into range).
func set_tracks(queue: Array, start: int) -> void:
	tracks = queue.duplicate()
	index = posmod(start, tracks.size()) if not tracks.is_empty() else 0

func is_empty() -> bool:
	return tracks.is_empty()

## The track at the queue's position, or {} with no queue.
func current() -> Dictionary:
	return {} if tracks.is_empty() else tracks[index]

## web playQueueAt(i ± 1) and the track-end advance: move `offset` tracks round and return the one there.
func step(offset: int) -> Dictionary:
	if tracks.is_empty():
		return {}
	index = posmod(index + offset, tracks.size())
	return current()
