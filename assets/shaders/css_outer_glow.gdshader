shader_type canvas_item;
// An outer CSS `box-shadow: 0 0 <blur> <glow_color>` alone, for a box with no fill of its own: the blurred box
// (css_box.gdshaderinc) clipped away over the box itself, as CSS clips an outer shadow to its border box. The node's
// rect is the box grown by `pad_px` on every side.

#include "res://assets/shaders/css_box.gdshaderinc"

uniform vec2 box_px = vec2(1.0);
uniform float pad_px = 0.0;
uniform float sigma = 1.0;
uniform vec4 glow_color : source_color = vec4(0.0);

varying vec4 modulate;

void vertex() {
	modulate = COLOR;
}

void fragment() {
	vec2 p = UV * (box_px + 2.0 * pad_px) - vec2(pad_px);
	float inside = pixel_span(p.x, 0.0, box_px.x) * pixel_span(p.y, 0.0, box_px.y);
	float spread = blurred_span(p.x, 0.0, box_px.x, sigma) * blurred_span(p.y, 0.0, box_px.y, sigma);
	COLOR = vec4(glow_color.rgb * modulate.rgb, glow_color.a * spread * (1.0 - inside) * modulate.a);
}
