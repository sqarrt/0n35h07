shader_type canvas_item;
// Final OVERHEAT lightning composite: the glowing bolts (a premultiplied SubViewport texture) shown with each bolt's
// own ov-strike opacity inside its paint region — web applies `opacity` to every .ov-bolt after its filter chain.
render_mode blend_premul_alpha;

const int MAX_BOLTS = 20;             // HudOverheatVignette.MAX_BOLTS: ten per side at SINGULARITY

uniform int bolt_count = 0;
uniform vec4 bolt_rects[MAX_BOLTS];   // x, y, width, height in screen pixels
uniform float bolt_opacity[MAX_BOLTS];
uniform vec2 screen_px = vec2(1280.0, 720.0);

void fragment() {
	vec2 px = UV * screen_px;
	float opacity = 0.0;
	for (int i = 0; i < bolt_count; i++) {
		vec4 r = bolt_rects[i];
		if (px.x >= r.x && px.y >= r.y && px.x < r.x + r.z && px.y < r.y + r.w) {
			opacity = max(opacity, bolt_opacity[i]);
		}
	}
	COLOR = texture(TEXTURE, UV) * opacity;
}
