shader_type canvas_item;
// web theme.css .warn-screen: an opaque base under radial-gradient(<radii> at <centre>, <glow>, transparent <stop>).
// CSS interpolates the stops premultiplied, so the glow keeps its colour while its alpha falls to 0 at the stop.

uniform vec2 size_px;
uniform vec2 centre_px;
uniform vec2 radii_px;
uniform float stop_share;
uniform vec4 base_color : source_color;
uniform vec4 glow_color : source_color;

void fragment() {
	vec2 offset = (UV * size_px - centre_px) / radii_px;
	float alpha = glow_color.a * clamp(1.0 - length(offset) / stop_share, 0.0, 1.0);
	COLOR = vec4(mix(base_color.rgb, glow_color.rgb, alpha), 1.0);
}
