shader_type canvas_item;
// The visualizer canvas composited like the web's `.rexp-vis { opacity: .5 }` inside `.rexp { overflow: hidden;
// border-radius }`: its premultiplied pixels at `opacity`, source-over, clipped to the window's inner rounded box.
render_mode blend_premul_alpha, unshaded;

uniform float opacity = 0.5;
uniform vec2 box_px = vec2(610.0, 370.0);
uniform float radius_px = 13.0;

float rounded_distance(vec2 p, vec2 half_size, float r) {
	vec2 q = abs(p) - half_size + vec2(r);
	return length(max(q, vec2(0.0))) + min(max(q.x, q.y), 0.0) - r;
}

void fragment() {
	vec4 canvas = texture(TEXTURE, UV);
	float clip = clamp(0.5 - rounded_distance(UV * box_px - box_px * 0.5, box_px * 0.5, radius_px), 0.0, 1.0);
	COLOR = canvas * opacity * clip;
}
