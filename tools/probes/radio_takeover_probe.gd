extends Node
## Probe (2026-09-15): the Radio takeover rendering in the running game. A scene, not a -s tool. The radio stays off (no
## sound on the machine); the Radio screen opens and the backdrop's beat spectrum is driven by a synthetic kick — one
## rise every beat at BPM — so the beat clock, the camera punch and the emoji rain run on the real backdrop, fonts and
## GPU. Counts the beats, the most emoji alive and the punched frames, and saves the frame with the most emoji to
## test-results/probes/radio_takeover/frame.png.
## (The live engine's bands were recorded too, 2026-09-15: 30 Hz, but at a quiet radio volume — below the engine's
## VIS_MIN_VOLUME — its lowest bands sit saturated with no kick flux, as the web page's would.)
##   Godot.exe --path . tools/probes/radio_takeover_probe.tscn

const MENU_SCENE := preload("res://scenes/main_menu.tscn")
const OUT_DIR := "res://test-results/probes/radio_takeover"
const FRAME := "/frame.png"
const RUN_S := 20.0
const OPEN_AFTER_S := 2.0
const BPM := 138.0
const MOOD := "dark_hypnotic"
const KICK := 0.9                               # the synthetic kick's band 0 and 1 on its frame
const KICK_DECAY := 0.85                        # per frame after it
const PUNCH_EPS := 0.001
const SECONDS_PER_MINUTE := 60.0

func _ready() -> void:
	Game.warning_seen = true
	Game.profile[Radio.KEY_ENABLED] = false
	var menu := MENU_SCENE.instantiate() as MainMenu
	menu.profile_saving = false
	add_child(menu)
	await get_tree().create_timer(OPEN_AFTER_S).timeout
	menu.open_radio()
	var backdrop := menu.backdrop()
	var bands := PackedFloat32Array()
	bands.resize(MenuBackdrop.BEAT_BANDS)
	backdrop.pin_beat_bands(bands)
	var interval := SECONDS_PER_MINUTE / BPM
	var elapsed := 0.0
	var next_kick := interval
	var beats := 0
	var last_target := 0.0
	var most_emoji := 0
	var punched_frames := 0
	var best_frame: Image = null
	while elapsed < RUN_S:
		backdrop.radio_bpm = BPM                 # the menu's radio refresh would reset them to the idle defaults
		backdrop.radio_mood = MOOD
		var level := 0.0
		if elapsed >= next_kick:
			next_kick += interval
			level = KICK
		for i in RadioBeatClock.KICK_BANDS:
			bands[i] = maxf(level, bands[i] * KICK_DECAY)
		await get_tree().process_frame
		elapsed += get_process_delta_time()
		var takeover := backdrop.takeover()
		if takeover == null:
			continue
		if takeover.punch().target() > last_target + PUNCH_EPS:   # a beat re-arms the zoom target upward
			beats += 1
		last_target = takeover.punch().target()
		if takeover.punch().punch > PUNCH_EPS:
			punched_frames += 1
		var alive := takeover.rain().active_count()
		if alive > most_emoji:
			most_emoji = alive
			best_frame = get_viewport().get_texture().get_image()
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(OUT_DIR))
	if best_frame != null:
		best_frame.save_png(OUT_DIR + FRAME)
	print("radio takeover probe: kicks %d, beats %d, most emoji %d, punched frames %d, frames %.0f Hz" % [
		floori(RUN_S / interval), beats, most_emoji, punched_frames, Engine.get_frames_per_second()])
	get_tree().quit()
