shader_type canvas_item;
// A solid CSS box with an outer `box-shadow: 0 0 <blur> <glow_color>`, solved analytically (css_box.gdshaderinc). The
// node's rect is the box grown by `pad_px` on every side; the core keeps partial pixel coverage for fractional widths.

#include "res://assets/shaders/css_box.gdshaderinc"

uniform vec2 box_px = vec2(1.0);
uniform float pad_px = 0.0;
uniform float sigma = 0.0;
uniform vec4 core_color : source_color = vec4(1.0);
uniform vec4 glow_color : source_color = vec4(0.0);

varying vec4 modulate;

void vertex() {
	modulate = COLOR;
}

void fragment() {
	vec2 p = UV * (box_px + 2.0 * pad_px) - vec2(pad_px);
	vec4 core = vec4(core_color.rgb, core_color.a * pixel_span(p.x, 0.0, box_px.x) * pixel_span(p.y, 0.0, box_px.y));
	vec4 glow = vec4(0.0);
	if (sigma > 0.0) {
		glow = vec4(glow_color.rgb,
			glow_color.a * blurred_span(p.x, 0.0, box_px.x, sigma) * blurred_span(p.y, 0.0, box_px.y, sigma));
	}
	vec4 color = over(core, glow);
	COLOR = vec4(color.rgb * modulate.rgb, color.a * modulate.a);
}
