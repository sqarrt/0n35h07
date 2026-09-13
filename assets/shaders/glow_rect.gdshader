shader_type canvas_item;
// A solid CSS box with an outer `box-shadow: 0 0 <blur> <glow_color>`, solved analytically: the Gaussian blur of a
// rectangle is a product of normal-CDF differences per axis (sigma = blur / 2). The node's rect is the box grown by
// `pad_px` on every side; the core keeps partial pixel coverage for fractional widths.

uniform vec2 box_px = vec2(1.0);
uniform float pad_px = 0.0;
uniform float sigma = 0.0;
uniform vec4 core_color : source_color = vec4(1.0);
uniform vec4 glow_color : source_color = vec4(0.0);

const float SQRT2 = 1.41421356;
// Abramowitz & Stegun 7.1.26 erf approximation (|error| < 1.5e-7).
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
	float y = 1.0 - (((((ERF_A5 * t + ERF_A4) * t) + ERF_A3) * t + ERF_A2) * t + ERF_A1) * t * exp(-a * a);
	return s * y;
}

float cdf(float t) {
	return 0.5 * (1.0 + erf_approx(t / SQRT2));
}

// Share of a blurred [lo, hi] span reaching coordinate p.
float blurred_span(float p, float lo, float hi) {
	return cdf((hi - p) / sigma) - cdf((lo - p) / sigma);
}

// Share of the pixel centred on p covered by [lo, hi].
float pixel_span(float p, float lo, float hi) {
	return clamp(min(p + HALF_PIXEL, hi) - max(p - HALF_PIXEL, lo), 0.0, 1.0);
}

vec4 over(vec4 src, vec4 dst) {
	float a = src.a + dst.a * (1.0 - src.a);
	vec3 rgb = a > 0.0 ? (src.rgb * src.a + dst.rgb * dst.a * (1.0 - src.a)) / a : vec3(0.0);
	return vec4(rgb, a);
}

void fragment() {
	vec2 p = UV * (box_px + 2.0 * pad_px) - vec2(pad_px);
	vec4 core = vec4(core_color.rgb, core_color.a * pixel_span(p.x, 0.0, box_px.x) * pixel_span(p.y, 0.0, box_px.y));
	vec4 glow = vec4(0.0);
	if (sigma > 0.0) {
		glow = vec4(glow_color.rgb, glow_color.a * blurred_span(p.x, 0.0, box_px.x) * blurred_span(p.y, 0.0, box_px.y));
	}
	vec4 color = over(core, glow);
	COLOR = vec4(color.rgb * modulate.rgb, color.a * modulate.a);
}
