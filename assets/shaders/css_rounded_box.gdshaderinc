// Rounded CSS boxes shared by the surface and shadow shaders: the signed distance to a rounded box, a pixel's coverage
// of it (Chrome's anti-aliased curve), and the Gaussian blur of a rounded box for box-shadow (Evan Wallace: each row of
// the box is a span blurred exactly across x, the rows integrated over the kernel's reach in y).

#include "res://assets/shaders/css_box.gdshaderinc"

const float ROUNDED_PIXEL_CENTRE = 0.5;
const float ROUNDED_KERNEL_SIGMAS = 3.0;
const int ROUNDED_SHADOW_ROWS = 24;

// Signed distance to a rounded box spanning lower..upper.
float rounded_distance(vec2 p, vec2 lower, vec2 upper, float r) {
	vec2 q = abs(p - (lower + upper) * 0.5) - (upper - lower) * 0.5 + r;
	return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

float rounded_coverage(float d) {
	return clamp(ROUNDED_PIXEL_CENTRE - d, 0.0, 1.0);
}

float rounded_shadow_row(float x, float y, vec2 half_size, float r, float s) {
	float delta = min(half_size.y - r - abs(y), 0.0);
	float curved = half_size.x - r + sqrt(max(0.0, r * r - delta * delta));
	return cdf((curved - x) / s) - cdf((-curved - x) / s);
}

// The share of a rounded box blurred by σ `s` reaching p.
float blurred_rounded_box(vec2 p, vec2 lower, vec2 upper, float r, float s) {
	vec2 half_size = (upper - lower) * 0.5;
	p -= (lower + upper) * 0.5;
	float start = clamp(-ROUNDED_KERNEL_SIGMAS * s, p.y - half_size.y, p.y + half_size.y);
	float end = clamp(ROUNDED_KERNEL_SIGMAS * s, p.y - half_size.y, p.y + half_size.y);
	float row = (end - start) / float(ROUNDED_SHADOW_ROWS);
	float y = start + row * ROUNDED_PIXEL_CENTRE;
	float value = 0.0;
	for (int i = 0; i < ROUNDED_SHADOW_ROWS; i++) {
		value += rounded_shadow_row(p.x, p.y - y, half_size, r, s) * exp(-0.5 * y * y / (s * s)) * row;
		y += row;
	}
	return value / (s * sqrt(2.0 * PI));
}
