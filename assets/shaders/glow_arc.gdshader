shader_type canvas_item;
// A streak spark (web theme.css .fx .arc): a 1px line painted with linear-gradient(90deg, transparent, #fff,
// var(--pc), transparent) under `filter: drop-shadow(0 0 3px var(--pc))`. The glow blurs the line alpha: across the
// line analytically (normal CDF), along it numerically over the gradient profile. The node's rect is the line grown
// by `pad_px` on every side and rotated about its centre.

uniform float length_px = 1.0;
uniform float pad_px = 0.0;
uniform float sigma = 0.0;
uniform vec4 player_color : source_color = vec4(1.0);

const float LINE_PX = 1.0;
const float STOP_WHITE = 1.0 / 3.0;
const float STOP_PLAYER = 2.0 / 3.0;
const int GLOW_TAPS = 8;              // samples per side along the line
const float KERNEL_SIGMAS = 3.0;
const float SQRT2 = 1.41421356;
const float ERF_P = 0.3275911;
const float ERF_A1 = 0.254829592;
const float ERF_A2 = -0.284496736;
const float ERF_A3 = 1.421413741;
const float ERF_A4 = -1.453152027;
const float ERF_A5 = 1.061405429;
const float HALF_PIXEL = 0.5;

varying vec4 modulate;

void vertex() {
	modulate = COLOR;
}

float erf_approx(float x) {
	float s = sign(x);
	float a = abs(x);
	float t = 1.0 / (1.0 + ERF_P * a);
	return s * (1.0 - (((((ERF_A5 * t + ERF_A4) * t) + ERF_A3) * t + ERF_A2) * t + ERF_A1) * t * exp(-a * a));
}

float cdf(float t) {
	return 0.5 * (1.0 + erf_approx(t / SQRT2));
}

float pixel_span(float p, float lo, float hi) {
	return clamp(min(p + HALF_PIXEL, hi) - max(p - HALF_PIXEL, lo), 0.0, 1.0);
}

// Gradient colour (straight alpha) at share u along the line; stops interpolate in premultiplied space.
vec4 gradient(float u) {
	if (u <= 0.0 || u >= 1.0) {
		return vec4(0.0);
	}
	if (u < STOP_WHITE) {
		return vec4(1.0, 1.0, 1.0, u / STOP_WHITE);
	}
	if (u < STOP_PLAYER) {
		return vec4(mix(vec3(1.0), player_color.rgb, (u - STOP_WHITE) / (STOP_PLAYER - STOP_WHITE)), 1.0);
	}
	return vec4(player_color.rgb, 1.0 - (u - STOP_PLAYER) / (1.0 - STOP_PLAYER));
}

vec4 over(vec4 src, vec4 dst) {
	float a = src.a + dst.a * (1.0 - src.a);
	vec3 rgb = a > 0.0 ? (src.rgb * src.a + dst.rgb * dst.a * (1.0 - src.a)) / a : vec3(0.0);
	return vec4(rgb, a);
}

void fragment() {
	vec2 p = UV * vec2(length_px + 2.0 * pad_px, LINE_PX + 2.0 * pad_px) - vec2(pad_px);
	vec4 core = gradient(p.x / length_px);
	core.a *= pixel_span(p.y, 0.0, LINE_PX);
	vec4 glow = vec4(0.0);
	if (sigma > 0.0) {
		float along = 0.0;
		float weights = 0.0;
		float tap = sigma * KERNEL_SIGMAS / float(GLOW_TAPS);
		for (int i = -GLOW_TAPS; i <= GLOW_TAPS; i++) {
			float dx = float(i) * tap;
			float w = exp(-0.5 * dx * dx / (sigma * sigma));
			along += w * gradient((p.x + dx) / length_px).a;
			weights += w;
		}
		float across = cdf((LINE_PX - p.y) / sigma) - cdf((0.0 - p.y) / sigma);
		glow = vec4(player_color.rgb, player_color.a * along / weights * across);
	}
	vec4 color = over(core, glow);
	COLOR = vec4(color.rgb * modulate.rgb, color.a * modulate.a);
}
