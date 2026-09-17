class_name MapLights
## Map light and sky — port of web MapLights (MapVisualBits.tsx) plus the App background behind the transparent
## game canvas. three.js lights are physically based (Lambert albedo/π) while Godot folds π into light energy,
## so web intensities are divided by π. The tonemapper is calibrated against real-GPU web frames.

const LIGHT_POS := Vector3(10, 20, 8)        # web LIGHT_POS; the sun aims at the arena centre
const WEB_SUN_INTENSITY := 1.05              # web directionalLight intensity
const WEB_AMBIENT_INTENSITY := 0.5           # web ambientLight intensity
const SKY_COLOR := Color("#0a0c11")          # web --bg under the transparent canvas
const AMBIENT_COLOR := Color.WHITE
const TONEMAPPER := Environment.TONE_MAPPER_LINEAR   # web frames are near-linear in the dark range (measured)

static func build() -> Node3D:
	var root := Node3D.new()
	root.name = "MapLights"

	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = SKY_COLOR
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = AMBIENT_COLOR
	env.ambient_light_energy = WEB_AMBIENT_INTENSITY / PI
	env.tonemap_mode = TONEMAPPER
	var world_env := WorldEnvironment.new()
	world_env.name = "Environment"
	world_env.environment = env
	root.add_child(world_env)

	var sun := DirectionalLight3D.new()
	sun.name = "Sun"
	sun.light_energy = WEB_SUN_INTENSITY / PI
	sun.shadow_enabled = true
	sun.transform = Transform3D(Basis.looking_at(-LIGHT_POS.normalized(), Vector3.UP), LIGHT_POS)
	root.add_child(sun)
	return root
