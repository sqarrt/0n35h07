shader_type canvas_item;
// An outer CSS `box-shadow: <offset> <blur> <spread> <color>` of a rounded box, drawn before the box: the blurred shadow
// shape (the box grown by the spread, its radius with it, moved by the offset) wherever the box itself does not cover
// the pixel — Chrome clips an outer shadow out of its border box. No screen read: the canvas blends it over what is
// there. The node's rect is the box grown by `pad_px`.

#include "res://assets/shaders/css_rounded_box.gdshaderinc"

uniform vec2 box_px = vec2(1.0);
uniform float pad_px = 0.0;
uniform float radius_px = 0.0;
uniform vec4 shadow_color : source_color = vec4(0.0);
uniform vec2 shadow_offset_px = vec2(0.0);
uniform float shadow_sigma = 0.0;              // a box-shadow blur is 2σ
uniform float shadow_spread_px = 0.0;

varying vec4 modulate;

void vertex() {
	modulate = COLOR;
}

void fragment() {
	vec2 p = UV * (box_px + 2.0 * pad_px) - vec2(pad_px);
	float inside = rounded_coverage(rounded_distance(p, vec2(0.0), box_px, radius_px));
	vec2 lower = shadow_offset_px - vec2(shadow_spread_px);
	vec2 upper = box_px + shadow_offset_px + vec2(shadow_spread_px);
	float r = max(radius_px + shadow_spread_px, 0.0);
	float shadow = shadow_sigma > 0.0 ? blurred_rounded_box(p, lower, upper, r, shadow_sigma)
		: rounded_coverage(rounded_distance(p, lower, upper, r));
	COLOR = vec4(shadow_color.rgb * modulate.rgb, shadow_color.a * shadow * (1.0 - inside) * modulate.a);
}
