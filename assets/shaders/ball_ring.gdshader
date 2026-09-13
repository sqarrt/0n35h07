shader_type spatial;
// Planet ring of the `planet` ball model — port of web createBallRing: a flat annulus (inner 0.62, outer 1.0) in the
// ring colour, brightening outward, with five drifting bands and soft edges; unlit, double-sided, no depth write.
render_mode unshaded, cull_disabled, depth_draw_never, blend_mix, shadows_disabled;

uniform vec4 ring_color : source_color = vec4(1.0);
uniform float time = 0.0;
uniform float opacity = 1.0;

const float INNER = 0.62;
const float OUTER = 1.0;
const float BANDS = 5.0;
const float SCROLL = 0.4;
const float EDGE_IN = 0.12;
const float EDGE_OUT = 0.82;
const float BAND_BASE = 0.6;
const float BAND_AMP = 0.4;
const float SHADE_BASE = 0.75;
const float SHADE_GAIN = 0.5;

varying float ring_t;

void vertex() {
	ring_t = (length(VERTEX.xy) - INNER) / (OUTER - INNER);
}

void fragment() {
	float edge = smoothstep(0.0, EDGE_IN, ring_t) * smoothstep(1.0, EDGE_OUT, ring_t);
	float bands = BAND_BASE + BAND_AMP * sin(ring_t * TAU * BANDS - time * SCROLL);
	ALBEDO = ring_color.rgb * (SHADE_BASE + SHADE_GAIN * ring_t);
	ALPHA = edge * bands * opacity;
}
