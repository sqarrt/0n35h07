extends GutTest
## Map lighting parity with web MapLights + the App background: sky colour, ambient + a shadowed sun from LIGHT_POS.

const EPS := 0.0001
const DIR_EPS := Vector3(0.001, 0.001, 0.001)

func _built() -> Node3D:
	var lights := MapLights.build()
	add_child_autofree(lights)
	return lights

func test_sun_shines_from_the_web_light_position_toward_the_arena_centre() -> void:
	var sun: DirectionalLight3D = _built().find_child("Sun", true, false)
	var travel := -sun.global_transform.basis.z   # a DirectionalLight3D shines along its local -Z
	assert_almost_eq(travel, -MapLights.LIGHT_POS.normalized(), DIR_EPS)
	assert_true(sun.shadow_enabled, "web directionalLight castShadow")

func test_three_js_intensities_become_godot_energies() -> void:
	var lights := _built()
	var sun: DirectionalLight3D = lights.find_child("Sun", true, false)
	var env: Environment = (lights.find_child("Environment", true, false) as WorldEnvironment).environment
	assert_almost_eq(sun.light_energy, MapLights.WEB_SUN_INTENSITY / PI, EPS, "Godot folds PI into light energy")
	assert_almost_eq(env.ambient_light_energy, MapLights.WEB_AMBIENT_INTENSITY / PI, EPS)

func test_sky_is_the_web_page_background() -> void:
	var env: Environment = (_built().find_child("Environment", true, false) as WorldEnvironment).environment
	assert_eq(env.background_mode, Environment.BG_COLOR)
	assert_eq(env.background_color, MapLights.SKY_COLOR, "web --bg behind the transparent canvas")
