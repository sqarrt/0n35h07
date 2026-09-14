shader_type canvas_item;
// theme.css .trailer-cut::before: a bar filled with linear-gradient(90deg, transparent, accent, transparent) under an
// outer box-shadow 0 0 22px accent — clipped away over the box, as CSS clips an outer shadow to its border box — scaled
// along X from its centre, which narrows the shadow with it (a sigma per axis). The node's rect is the scaled box grown
// by `pad_px`.

#include "res://assets/shaders/css_box.gdshaderinc"

uniform vec2 box_px = vec2(1.0);
uniform vec2 pad_px = vec2(0.0);
uniform vec2 sigma_px = vec2(1.0);
uniform vec4 color : source_color = vec4(1.0);

const float GRADIENT_PEAK = 0.5;   // the middle stop of the three-stop gradient

varying vec4 modulate;

void vertex() {
	modulate = COLOR;
}

void fragment() {
	vec2 p = UV * (box_px + 2.0 * pad_px) - pad_px;
	float inside = pixel_span(p.x, 0.0, box_px.x) * pixel_span(p.y, 0.0, box_px.y);
	float ramp = 1.0 - abs(clamp(p.x / box_px.x, 0.0, 1.0) - GRADIENT_PEAK) / GRADIENT_PEAK;
	vec4 core = vec4(color.rgb, color.a * ramp * inside);
	float spread = blurred_span(p.x, 0.0, box_px.x, sigma_px.x) * blurred_span(p.y, 0.0, box_px.y, sigma_px.y);
	vec4 glow = vec4(color.rgb, color.a * spread * (1.0 - inside));
	vec4 result = over(core, glow);
	COLOR = vec4(result.rgb * modulate.rgb, result.a * modulate.a);
}
