shader_type canvas_item;
// Shows a composited EffectText (premultiplied SubViewport texture) through the web SVG filter ks-elN:
// feTurbulence type="fractalNoise" (gradient noise summed over octaves) feeding feDisplacementMap on the alpha channel
// (both axes shift by scale * (A - 0.5)), clipped to the filter region (StreakFx.filter_region). Noise coordinates
// start at the element box origin. scale_px = 0 means no filter (CATALYST): the texture is shown unclipped.
render_mode blend_premul_alpha;

uniform float scale_px = 0.0;
uniform vec2 base_frequency = vec2(0.0);
uniform int octaves = 1;
uniform float seed = 0.0;
uniform vec2 box_origin_px = vec2(0.0);
uniform vec2 region_origin_px = vec2(0.0);
uniform vec2 region_size_px = vec2(1.0);

const float NOISE_HALF = 0.5;
const float OCTAVE_GAIN = 0.5;
const float OCTAVE_LACUNARITY = 2.0;
const vec2 HASH_AXIS = vec2(127.1, 311.7);
const float HASH_SCALE = 43758.5453;

varying vec4 modulate;

void vertex() {
	modulate = COLOR;
}

vec2 lattice_gradient(vec2 cell) {
	float angle = fract(sin(dot(cell + vec2(seed), HASH_AXIS)) * HASH_SCALE) * TAU;
	return vec2(cos(angle), sin(angle));
}

float gradient_noise(vec2 p) {
	vec2 cell = floor(p);
	vec2 f = fract(p);
	vec2 u = f * f * (3.0 - 2.0 * f);
	float n00 = dot(lattice_gradient(cell), f);
	float n10 = dot(lattice_gradient(cell + vec2(1.0, 0.0)), f - vec2(1.0, 0.0));
	float n01 = dot(lattice_gradient(cell + vec2(0.0, 1.0)), f - vec2(0.0, 1.0));
	float n11 = dot(lattice_gradient(cell + vec2(1.0, 1.0)), f - vec2(1.0, 1.0));
	return mix(mix(n00, n10, u.x), mix(n01, n11, u.x), u.y);
}

float fractal_noise(vec2 p) {
	float sum = 0.0;
	float amplitude = 1.0;
	for (int o = 0; o < octaves; o++) {
		sum += gradient_noise(p) * amplitude;
		p *= OCTAVE_LACUNARITY;
		amplitude *= OCTAVE_GAIN;
	}
	return sum;
}

bool in_region(vec2 p) {
	return all(greaterThanEqual(p, region_origin_px)) && all(lessThan(p, region_origin_px + region_size_px));
}

vec4 faded(vec4 premultiplied) {
	return vec4(premultiplied.rgb * modulate.rgb * modulate.a, premultiplied.a * modulate.a);
}

void fragment() {
	vec2 texture_px = 1.0 / TEXTURE_PIXEL_SIZE;
	vec2 p = UV * texture_px;
	if (scale_px <= 0.0) {
		COLOR = faded(texture(TEXTURE, UV));
	} else if (!in_region(p)) {
		COLOR = vec4(0.0);
	} else {
		float a = clamp((fractal_noise((p - box_origin_px) * base_frequency) + 1.0) * NOISE_HALF, 0.0, 1.0);
		vec2 source = p + vec2(scale_px * (a - NOISE_HALF));
		COLOR = in_region(source) ? faded(texture(TEXTURE, source / texture_px)) : vec4(0.0);
	}
}
