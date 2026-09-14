extends SceneTree
## Dev probe: the UI font's vertical metrics at the stats overlay size, for reproducing Chrome's baseline placement.
##   <godot> --headless -s tools/font_metrics_probe.gd

func _initialize() -> void:
	var size := HudStatsOverlay.FONT_SIZE
	var spaced := UiFont.spaced(HudStatsOverlay.LETTER_SPACING_EM, size)
	var base := UiFont.base()
	print("FONT spaced ascent=%.4f descent=%.4f height=%.4f | base ascent=%.4f descent=%.4f height=%.4f" % [
		spaced.get_ascent(size), spaced.get_descent(size), spaced.get_height(size),
		base.get_ascent(size), base.get_descent(size), base.get_height(size)])
	quit()
