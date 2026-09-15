extends GutTest
## MenuBackdrop's Radio takeover — web MenuBackdrop radioMode: the takeover lives in the 3D world only while the Radio
## screen is up, steps after the camera rig with the track's mood and tempo, and a pinned silent spectrum keeps the
## camera where the rig put it (no beat, no emoji).

const SCREEN := Vector2i(1280, 720)
const FRAME_S := 1.0 / 60.0

func _backdrop() -> MenuBackdrop:
	var viewport := SubViewport.new()
	viewport.size = SCREEN
	add_child_autofree(viewport)
	var backdrop := MenuBackdrop.new()
	viewport.add_child(backdrop)
	backdrop.size = Vector2(SCREEN)
	return backdrop

func test_the_takeover_comes_and_goes_with_the_radio_screen() -> void:
	var backdrop := _backdrop()
	backdrop._process(FRAME_S)
	assert_null(backdrop.takeover())
	backdrop.radio_mode = true
	backdrop._process(FRAME_S)
	assert_not_null(backdrop.takeover())
	assert_eq(backdrop.takeover().get_parent(), backdrop.world(), "in the backdrop's 3D world, like the web Canvas child")
	backdrop.radio_mode = false
	backdrop._process(FRAME_S)
	assert_null(backdrop.takeover())

func test_a_silent_spectrum_leaves_the_camera_on_the_rig() -> void:
	var backdrop := _backdrop()
	backdrop.pin_beat_bands(PackedFloat32Array())
	backdrop.radio_mode = true
	backdrop.radio_mood = "dark_techno"
	for i in 30:
		backdrop._process(FRAME_S)
	assert_eq(backdrop.camera().position, backdrop.rig.position, "no punch without a beat")
	assert_eq(backdrop.takeover().rain().active_count(), 0, "no emoji without a beat")
