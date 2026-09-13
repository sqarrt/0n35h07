shader_type canvas_item;
// HUD screen vignette: ports the web CSS overlays in one full-screen pass, painted like CSS paints an element —
// background first (a radial gradient or a line grid), then an inset box-shadow glow on top.
//   radial-gradient(ellipse at center, transparent <inner_stop>, <edge_color> 100%)   (farthest-corner ellipse)
//   linear-gradient(<grid_color> 1px, transparent 1px) in both axes, repeated every <grid_px>
//   box-shadow: inset 0 0 <glow_px> <glow_color>

uniform vec4 edge_color : source_color = vec4(0.0);
uniform float inner_stop = 0.5;
uniform vec4 grid_color : source_color = vec4(0.0);
uniform float grid_px = 0.0;          // 0 = no grid
uniform float grid_line_px = 1.0;
uniform vec4 glow_color : source_color = vec4(0.0);
uniform float glow_px = 0.0;          // CSS blur radius; 0 = no glow
uniform vec2 screen_px = vec2(1280.0, 720.0);

const float CSS_BLUR_TO_SIGMA = 0.5;  // CSS: a blur radius B is a Gaussian with standard deviation B / 2
const float LOGISTIC_GAUSS = 1.702;   // logistic approximation of the normal CDF
const float CORNER_RADIUS = 1.41421356;

varying vec4 modulate;                // the node's modulate: CSS opacity of the overlay element

void vertex() {
	modulate = COLOR;
}

vec4 over(vec4 src, vec4 dst) {       // straight-alpha "over"
	float a = src.a + dst.a * (1.0 - src.a);
	vec3 rgb = a > 0.0 ? (src.rgb * src.a + dst.rgb * dst.a * (1.0 - src.a)) / a : vec3(0.0);
	return vec4(rgb, a);
}

// Share of an inset shadow reaching a point `x` pixels inside one edge.
float edge_shadow(float x, float sigma) {
	return 1.0 / (1.0 + exp(LOGISTIC_GAUSS * x / sigma));
}

void fragment() {
	vec2 px = UV * screen_px;
	vec4 color = vec4(0.0);

	if (edge_color.a > 0.0) {
		float r = length((UV - 0.5) * 2.0) / CORNER_RADIUS;   // 0 at the centre, 1 at the corners
		float t = clamp((r - inner_stop) / (1.0 - inner_stop), 0.0, 1.0);
		color = vec4(edge_color.rgb, edge_color.a * t);
	}

	if (grid_px > 0.0) {
		vec2 cell = mod(px, grid_px);
		float line = (cell.x < grid_line_px || cell.y < grid_line_px) ? grid_color.a : 0.0;
		color = over(vec4(grid_color.rgb, line), color);
	}

	if (glow_px > 0.0) {
		float sigma = glow_px * CSS_BLUR_TO_SIGMA;
		float clear = (1.0 - edge_shadow(px.x, sigma)) * (1.0 - edge_shadow(screen_px.x - px.x, sigma))
			* (1.0 - edge_shadow(px.y, sigma)) * (1.0 - edge_shadow(screen_px.y - px.y, sigma));
		color = over(vec4(glow_color.rgb, glow_color.a * (1.0 - clear)), color);
	}

	COLOR = vec4(color.rgb * modulate.rgb, color.a * modulate.a);
}
