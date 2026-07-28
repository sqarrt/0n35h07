extends Node
## Global game root (autoload). Stub host for the future OneShot simulation.
## No gameplay yet — later sub-projects grow the Match/world here.

const GAME_VERSION := "2.0.0"

func _ready() -> void:
	print("OneShot ", GAME_VERSION, " — Godot foundation ready")
