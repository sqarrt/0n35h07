class_name AudioBuses
## Runtime audio buses owned by the music and SFX engines: created on demand with a send target, removed with their
## owner. Indices shift when a bus goes away, so buses are always looked up by name.

## The index of bus `bus_name`, creating it (sending into `send`) when it does not exist yet.
static func ensure(bus_name: String, send: String) -> int:
	var index := AudioServer.get_bus_index(bus_name)
	if index != -1:
		return index
	AudioServer.add_bus()
	index = AudioServer.get_bus_count() - 1
	AudioServer.set_bus_name(index, bus_name)
	AudioServer.set_bus_send(index, send)
	return index

static func remove(bus_name: String) -> void:
	var index := AudioServer.get_bus_index(bus_name)
	if index != -1:
		AudioServer.remove_bus(index)

## An effect of bus `bus_name` by its position in the chain.
static func effect(bus_name: String, position: int) -> AudioEffect:
	return AudioServer.get_bus_effect(AudioServer.get_bus_index(bus_name), position)
