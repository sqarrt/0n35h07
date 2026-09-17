extends GutTest

func test_dome_toggles() -> void:
	var fx := ShieldFx.new()
	add_child_autofree(fx)
	assert_false(fx.is_dome_visible(), "hidden by default")
	fx.show_dome(true)
	assert_true(fx.is_dome_visible())
	fx.show_dome(false)
	assert_false(fx.is_dome_visible())
