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
uniform float dash_px = 0.0;                 // a dashed border: dashes this long (0: solid) ...
uniform float dash_gap_px = 0.0;             // ... this far apart, along the outline clockwise from the top-left corner's end

const float QUARTER_TURN = 1.5707963;

// Where along the outline (uniform radius r) the point nearest `p` lies: clockwise from (left + r, top).
float outline_distance(vec2 p, vec2 half_size, float r) {
	float top = 2.0 * (half_size.x - r);
	float side = 2.0 * (half_size.y - r);
	float arc = QUARTER_TURN * r;
	if (abs(p.x) <= half_size.x - r) {
		return p.y < 0.0 ? p.x + half_size.x - r : top + arc + side + arc + (half_size.x - r - p.x);
	}
	if (abs(p.y) <= half_size.y - r) {
		return p.x > 0.0 ? top + arc + (p.y + half_size.y - r) : 2.0 * (top + arc) + side + arc + (half_size.y - r - p.y);
	}
	vec2 centre = vec2(sign(p.x) * (half_size.x - r), sign(p.y) * (half_size.y - r));
	float angle = atan(p.y - centre.y, p.x - centre.x);
	if (p.x > 0.0 && p.y < 0.0) return top + (angle + QUARTER_TURN) * r;
	if (p.x > 0.0) return top + arc + side + angle * r;
	if (p.y > 0.0) return top + arc + side + arc + top + (angle - QUARTER_TURN) * r;
	return 2.0 * (top + arc + side + arc) - arc + (angle + 2.0 * QUARTER_TURN) * r;
}

// Straight-alpha `top` over `bottom`: the alphas combine, the colours mix by what the top adds.
vec4 over(vec4 top, vec4 bottom) {
	float alpha = top.a + bottom.a * (1.0 - top.a);
	return vec4(mix(bottom.rgb, top.rgb, top.a / max(alpha, 0.0001)), alpha);
}

// How much of a pixel at outline distance `s` a dash covers (a 1 px wide ramp at each dash end).
float dash_coverage(float s) {
	float period = dash_px + dash_gap_px;
	float m = s - period * floor(s / period);                // [0, period)
	float inside = min(m, dash_px - m);                      // how far inside the dash
	float outside = min(m - dash_px, period - m);            // how far inside the gap
	float signed_inside = mix(-outside, inside, step(m, dash_px));
	return clamp(signed_inside + 0.5, 0.0, 1.0);
}

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
	if (inset_sigma > 0.0) {                  // the outside of the box, blurred, seen inside it, over the background
		float glow = 0.5 * erfc_approx(-d / (inset_sigma * sqrt(2.0)));
		fill = over(vec4(inset_color.rgb, inset_color.a * glow), fill);
	}
	if (border_px > 0.0) {
		float border = clamp(0.5 - d, 0.0, 1.0) - clamp(0.5 - (d + border_px), 0.0, 1.0);
		if (dash_px > 0.0) {
			border *= dash_coverage(outline_distance(p, box_px * 0.5, radii.x));
		}
		fill = over(vec4(border_color.rgb, border_color.a * border), fill);
	}
	COLOR = vec4(fill.rgb, fill.a * coverage);
}
