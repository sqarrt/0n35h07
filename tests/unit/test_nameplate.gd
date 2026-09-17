extends GutTest
## Name plates — web game/fx/nameplate.ts and Player.setNameplate: the drawn name (truncated with an ellipsis), the
## world size and height, and the plate dying with the body until the respawn.

const PLAYER := preload("res://scenes/player.tscn")
const EPS := 0.0001

func test_names_are_truncated_like_the_web_canvas() -> void:
	assert_eq(Nameplate.label_text("EX82R"), "EX82R")
	assert_eq(Nameplate.label_text("ABCDEFGHIJKL"), "ABCDEFGHIJKL", "12 characters still fit")
	assert_eq(Nameplate.label_text("ABCDEFGHIJKLM"), "ABCDEFGHIJK…", "longer: 11 characters and an ellipsis")

func test_plate_size_height_and_colours() -> void:
	var plate := Nameplate.create("B1", GameModes.TEAM_COLORS[1])
	add_child_autofree(plate)
	assert_eq(plate.text(), "B1")
	assert_almost_eq(plate.pixel_size * Nameplate.PLATE_SIZE.x, Nameplate.WORLD_SIZE.x, EPS, "1.6 world units wide")
	assert_almost_eq(plate.pixel_size * Nameplate.PLATE_SIZE.y, Nameplate.WORLD_SIZE.y, EPS, "0.4 world units tall")
	assert_almost_eq(plate.position.y, Nameplate.HEIGHT, EPS)
	assert_eq(plate.billboard, BaseMaterial3D.BILLBOARD_ENABLED)
	var material := plate.material_override as ShaderMaterial
	assert_eq(material.shader, Nameplate.SHADER, "composited in linear light like the web canvas")
	var team: Color = GameModes.TEAM_COLORS[1]
	assert_eq(material.get_shader_parameter("background_linear"), Vector3(team.r, team.g, team.b),
		"the canvas colour numbers, unconverted: three.js reads them as linear light")
	assert_almost_eq(float(material.get_shader_parameter("background_alpha")), Nameplate.BACKGROUND_ALPHA, EPS)
	assert_almost_eq(float(material.get_shader_parameter("radius_px")), Nameplate.PLATE_RADIUS, EPS)
	assert_eq(Nameplate.web_canvas_color(Color("#ff5533")), Color(Color("#ff5533").linear_to_srgb(), 1.0))

func test_the_plate_dies_with_the_body() -> void:
	var pnode: PlayerNode = PLAYER.instantiate()
	pnode.get_node("Camera3D").free()
	add_child_autofree(pnode)
	pnode.apply_appearance({"color": "#ffdd44"})
	pnode.set_nameplate(Nameplate.create("B2", Nameplate.NEUTRAL_COLOR))
	assert_eq(pnode.nameplate().get_parent(), pnode)
	pnode.player.alive = false
	pnode.update_visuals(0.0)
	assert_false(pnode.nameplate().visible, "web receiveHit hides it")
	pnode.player.alive = true
	pnode.update_visuals(0.0)
	assert_true(pnode.nameplate().visible, "web respawnAt shows it again")
