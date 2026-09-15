shader_type canvas_item;
// One CSS box of the Radio library (RadioExplorer.css icons and item states): a rounded rectangle with a top-to-bottom
// linear-gradient fill, a border inside its edge (border-box) and an inset box-shadow glow (0 0 blur). The rect is the
// box itself; UV × box_px is the pixel centre.

uniform vec2 box_px = vec2(52.0, 34.0);
uniform vec4 radii = vec4(5.0);              // top-left, top-right, bottom-right, bottom-left
uniform vec4 top_color : source_color = vec4(0.0);
uniform vec4 bottom_color : source_color = vec4(0.0);
uniform float border_px = 0.0;
uniform vec4 border_color : source_color = vec4(0.0);
uniform float inset_sigma = 0.0;             // an inset glow: blur / 2
uniform vec4 inset_color : source_color = vec4(0.0);

float rounded_distance(vec2 p, vec2 half_size, vec4 r) {
	float radius = p.x < 0.0 ? (p.y < 0.0 ? r.x : r.w) : (p.y < 0.0 ? r.y : r.z);
	vec2 q = abs(p) - half_size + vec2(radius);
	return length(max(q, vec2(0.0))) + min(max(q.x, q.y), 0.0) - radius;
}

// erfc through Abramowitz-Stegun 7.1.26 (good to 1.5e-7): the share of a Gaussian past a distance
float erfc_approx(float x) {
	float t = 1.0 / (1.0 + 0.3275911 * abs(x));
	float y = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
	float e = y * exp(-x * x);
	return x >= 0.0 ? e : 2.0 - e;
}

void fragment() {
	vec2 p = UV * box_px - box_px * 0.5;
	float d = rounded_distance(p, box_px * 0.5, radii);
	float coverage = clamp(0.5 - d, 0.0, 1.0);
	vec4 fill = mix(top_color, bottom_color, UV.y);
	if (inset_sigma > 0.0) {                  // the outside of the box, blurred, seen inside it
		float glow = 0.5 * erfc_approx(-d / (inset_sigma * sqrt(2.0)));
		fill = mix(fill, vec4(inset_color.rgb, 1.0), inset_color.a * glow * (1.0 - fill.a) / max(1.0 - fill.a * (1.0 - inset_color.a * glow), 0.0001));
		fill.a = fill.a + inset_color.a * glow * (1.0 - fill.a);
	}
	if (border_px > 0.0) {
		float border = clamp(0.5 - d, 0.0, 1.0) - clamp(0.5 - (d + border_px), 0.0, 1.0);
		fill = mix(fill, vec4(border_color.rgb, 1.0), border * border_color.a / max(fill.a + border * border_color.a * (1.0 - fill.a), 0.0001));
		fill.a = fill.a + border * border_color.a * (1.0 - fill.a);
	}
	COLOR = vec4(fill.rgb, fill.a * coverage);
}
