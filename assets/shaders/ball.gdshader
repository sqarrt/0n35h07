shader_type spatial;
// three.js keeps depthWrite on a transparent ball: the ghost hides the same-centre trail clones inside it.
render_mode depth_draw_always;
// The combat ball — port of web ballMaterial.ts over a MeshStandardMaterial (roughness 1, metalness 0): the player
// colour, the `waves` model's travelling vertex waves along the normal, and the ball artwork sampled through a disc
// projection of the model normal (front hemisphere = local -Z, the aim side). Ghost opacity comes from the instance
// transparency, which keeps shadows.

uniform vec4 albedo : source_color = vec4(1.0);
uniform vec3 emission = vec3(0.0);          // linear, like three.js material.emissive
uniform bool waves = false;
uniform float time = 0.0;
uniform sampler2D art : filter_nearest, repeat_disable, hint_default_white;

#include "res://assets/shaders/ball_waves.gdshaderinc"

const float HALF = 0.5;

varying vec3 art_normal;

void vertex() {
	art_normal = NORMAL;
	if (waves) {
		VERTEX = ball_waves(VERTEX, NORMAL, time);
	}
}

void fragment() {
	vec3 nrm = normalize(art_normal);
	float is_front = step(nrm.z, 0.0);
	float ang = acos(clamp(abs(nrm.z), 0.0, 1.0));
	float rad = ang / (PI * HALF);
	float phi = atan(nrm.y, mix(nrm.x, -nrm.x, is_front));
	vec2 disc = vec2(HALF + HALF * rad * cos(phi), HALF + HALF * rad * sin(phi));
	float u = disc.x * HALF + (1.0 - is_front) * HALF;
	float multiplier = texture(art, vec2(u, disc.y)).r;
	ALBEDO = albedo.rgb * multiplier;
	EMISSION = emission;
	ROUGHNESS = 1.0;
	METALLIC = 0.0;
}
