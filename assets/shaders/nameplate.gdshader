shader_type spatial;
// Web name plate (game/fx/nameplate.ts) composited the way three.js shows its canvas: the canvas carries no colour
// space, so its numbers are linear light. The rounded background (radius, 85% opacity) and the name texture are
// laid over each other here in those numbers and blended premultiplied — a 2D viewport would premultiply in sRGB and
// darken the see-through background. Billboard, unlit, no depth write (web depthWrite: false).
render_mode unshaded, cull_disabled, blend_premul_alpha, depth_draw_never;

uniform sampler2D text_texture : source_color, filter_linear;   // the name, premultiplied, from the plate viewport
uniform vec3 background_linear = vec3(1.0);                     // the web canvas colour as linear light
uniform float background_alpha = 0.85;
uniform vec2 plate_px = vec2(256.0, 64.0);
uniform float radius_px = 18.0;

const float HALF = 0.5;
const float AA_PX = 1.0;

void vertex() {
	MODELVIEW_MATRIX = VIEW_MATRIX * mat4(INV_VIEW_MATRIX[0], INV_VIEW_MATRIX[1], INV_VIEW_MATRIX[2], MODEL_MATRIX[3]);
}

// Coverage of the rounded rectangle at plate pixel p (signed distance, one pixel of antialiasing like the canvas fill).
float rounded_cover(vec2 p) {
	vec2 half_size = plate_px * HALF;
	vec2 q = abs(p - half_size) - (half_size - vec2(radius_px));
	float distance = length(max(q, vec2(0.0))) + min(max(q.x, q.y), 0.0) - radius_px;
	return clamp(HALF - distance / AA_PX, 0.0, 1.0);
}

void fragment() {
	vec2 p = UV * plate_px;
	float bg_alpha = background_alpha * rounded_cover(p);
	vec4 text = texture(text_texture, UV);
	vec3 rgb = text.rgb + background_linear * bg_alpha * (1.0 - text.a);
	float alpha = text.a + bg_alpha * (1.0 - text.a);
	ALBEDO = rgb;
	ALPHA = alpha;
}
