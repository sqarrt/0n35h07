shader_type canvas_item;
// The painted chrome of a Radio window (web RadioExplorer.css .rexp, overflow: hidden): the title bar's accent gradient
// with the 1 px surface-line rule at its bottom, and the resize corner's two 135° stripes — all clipped to the window's
// inner rounded box (the border radius less the border). The rect covers the inner box; UV × box_px is the pixel centre.

uniform vec2 box_px = vec2(254.0, 618.0);
uniform float radius_px = 13.0;
uniform float title_px = 30.0;            // the bar with its rule
uniform float rule_px = 1.0;
uniform vec4 top_color : source_color;
uniform vec4 bottom_color : source_color;
uniform vec4 rule_color : source_color;
uniform bool show_corner = true;
uniform float corner_px = 16.0;
uniform vec4 stripe_color : source_color;
uniform vec4 stripes = vec4(0.55, 0.63, 0.74, 0.82);   // two [from, to) bands along the gradient line

float inside_rounded(vec2 p) {
	vec2 q = abs(p - box_px * 0.5) - (box_px * 0.5 - vec2(radius_px));
	float distance = length(max(q, vec2(0.0))) + min(max(q.x, q.y), 0.0) - radius_px;
	return clamp(0.5 - distance, 0.0, 1.0);
}

void fragment() {
	vec2 p = UV * box_px;
	vec4 color = vec4(0.0);
	if (p.y < title_px) {
		color = mix(top_color, bottom_color, p.y / title_px);   // linear-gradient(180deg) over the bar's box
	}
	if (p.y >= title_px - rule_px && p.y < title_px) {
		color = rule_color;
	}
	if (show_corner) {
		vec2 q = p - (box_px - vec2(corner_px));
		if (q.x >= 0.0 && q.y >= 0.0) {
			float t = (q.x + q.y) / (2.0 * corner_px);          // 135° on a square: the diagonal's share
			if ((t >= stripes.x && t < stripes.y) || (t >= stripes.z && t < stripes.w)) {
				color = stripe_color;
			}
		}
	}
	COLOR = vec4(color.rgb, color.a * inside_rounded(p));
}
