shader_type canvas_item;
// The rest of the glass card (glass.ts glassCard) in one pass over the screen as it stands, the node's rect being the
// border box grown by `pad_px`: inside the rounded box the vertical half of the backdrop blur (the horizontal half was
// drawn into the box before the screen copy) and saturate(), the fill, the inset top highlight and the border; outside
// it the thin ring under the drop shadow. Every layer keeps Chrome's partial pixel coverage of the curve.

#include "res://assets/shaders/css_box.gdshaderinc"

uniform sampler2D screen_texture : hint_screen_texture, filter_nearest, repeat_disable;
uniform vec2 box_px = vec2(1.0);              // the border box in pixels
uniform float pad_px = 0.0;
uniform float radius_px = 0.0;                // border-radius
uniform float border_px = 1.0;
uniform float sigma = 0.0;                    // backdrop-filter blur σ
uniform float saturation = 1.0;               // backdrop-filter saturate()
uniform vec4 fill_color : source_color = vec4(0.0);
uniform vec4 border_color : source_color = vec4(0.0);
uniform vec4 highlight_color : source_color = vec4(0.0);   // inset 0 <highlight_px> 0
uniform float highlight_px = 0.0;
uniform vec4 ring_color : source_color = vec4(0.0);        // 0 0 0 <ring_px>
uniform float ring_px = 0.0;
uniform vec4 shadow_color : source_color = vec4(0.0);      // <shadow_offset_px> blur (σ shadow_sigma)
uniform vec2 shadow_offset_px = vec2(0.0);
uniform float shadow_sigma = 0.0;

const int MAX_RADIUS = 96;
const float KERNEL_SIGMAS = 3.0;
const float MIN_SIGMA = 0.05;
const float PIXEL_CENTRE = 0.5;
const int SHADOW_ROWS = 24;
const vec3 SATURATE_LUMA = vec3(0.213, 0.715, 0.072);     // Filter Effects saturate() matrix, on the sRGB values

varying vec4 modulate;

void vertex() {
	modulate = COLOR;
}

// Signed distance to a rounded box spanning lower..upper.
float rounded_distance(vec2 p, vec2 lower, vec2 upper, float r) {
	vec2 q = abs(p - (lower + upper) * 0.5) - (upper - lower) * 0.5 + r;
	return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

float coverage(float d) {
	return clamp(PIXEL_CENTRE - d, 0.0, 1.0);
}

// A blurred rounded box (Evan Wallace): each row of the box is a span, blurred exactly across x; the rows are integrated
// over the kernel's reach in y.
float shadow_row(float x, float y, vec2 half_size, float r, float s) {
	float delta = min(half_size.y - r - abs(y), 0.0);
	float curved = half_size.x - r + sqrt(max(0.0, r * r - delta * delta));
	return cdf((curved - x) / s) - cdf((-curved - x) / s);
}

float blurred_rounded_box(vec2 p, vec2 lower, vec2 upper, float r, float s) {
	vec2 half_size = (upper - lower) * 0.5;
	p -= (lower + upper) * 0.5;
	float start = clamp(-KERNEL_SIGMAS * s, p.y - half_size.y, p.y + half_size.y);
	float end = clamp(KERNEL_SIGMAS * s, p.y - half_size.y, p.y + half_size.y);
	float row = (end - start) / float(SHADOW_ROWS);
	float y = start + row * PIXEL_CENTRE;
	float value = 0.0;
	for (int i = 0; i < SHADOW_ROWS; i++) {
		value += shadow_row(p.x, p.y - y, half_size, r, s) * exp(-0.5 * y * y / (s * s)) * row;
		y += row;
	}
	return value / (s * sqrt(2.0 * PI));
}

vec3 backdrop(vec2 p, vec2 box_origin_uv, vec2 pixel_uv, vec3 here) {
	if (sigma < MIN_SIGMA) {
		return here;
	}
	vec2 centre = floor(p) + PIXEL_CENTRE;
	int radius = min(int(ceil(sigma * KERNEL_SIGMAS)), MAX_RADIUS);
	vec3 total = vec3(0.0);
	float weights = 0.0;
	for (int dy = -radius; dy <= radius; dy++) {
		float y = box_px.y - abs(box_px.y - abs(centre.y + float(dy)));   // mirrored into the box
		float w = exp(-0.5 * float(dy * dy) / (sigma * sigma));
		total += w * textureLod(screen_texture, box_origin_uv + vec2(centre.x, y) * pixel_uv, 0.0).rgb;
		weights += w;
	}
	vec3 blurred = total / weights;
	float luma = dot(blurred, SATURATE_LUMA);
	return clamp(vec3(luma) + saturation * (blurred - vec3(luma)), 0.0, 1.0);
}

void fragment() {
	vec2 p = UV * (box_px + 2.0 * pad_px) - vec2(pad_px);
	vec3 color = textureLod(screen_texture, SCREEN_UV, 0.0).rgb;
	float d = rounded_distance(p, vec2(0.0), box_px, radius_px);
	float inside = coverage(d);
	color = mix(color, ring_color.rgb, ring_color.a * coverage(d - ring_px) * (1.0 - inside));
	if (shadow_sigma > 0.0) {
		float shadow = blurred_rounded_box(p, shadow_offset_px, box_px + shadow_offset_px, radius_px, shadow_sigma);
		color = mix(color, shadow_color.rgb, shadow_color.a * shadow * (1.0 - inside));
	}
	if (inside > 0.0) {
		vec2 box_origin_uv = SCREEN_UV - p * SCREEN_PIXEL_SIZE;
		color = mix(color, backdrop(p, box_origin_uv, SCREEN_PIXEL_SIZE, color), inside);
		color = mix(color, fill_color.rgb, fill_color.a * inside);
		vec2 inner_lower = vec2(border_px);
		vec2 inner_upper = box_px - vec2(border_px);
		float inner_radius = max(radius_px - border_px, 0.0);
		float padding = coverage(rounded_distance(p, inner_lower, inner_upper, inner_radius));
		float hole = coverage(rounded_distance(p - vec2(0.0, highlight_px), inner_lower, inner_upper, inner_radius));
		color = mix(color, highlight_color.rgb, highlight_color.a * padding * (1.0 - hole));
		color = mix(color, border_color.rgb, border_color.a * max(inside - padding, 0.0));
	}
	COLOR = vec4(color, modulate.a);
}
