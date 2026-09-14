shader_type canvas_item;
// Menu edge glow — web MenuEdgeGlow EdgeGlowEffect, drawn into a float viewport: around each pixel 8 points on a disk
// of blur_px; a point on a model whose depth jumps against its ±grad_px neighbours counts as edge, and the edge takes the
// average model colour of the points (plus a little white) times gain, added to the scene in linear light:
//   out = vec4(scene.rgb + acc / 8 · mix(modelCol, 1, white) · gain · intensity, scene.a)
// The scene is the backdrop viewport: premultiplied, sRGB-encoded bytes → decoded here. The model colour comes from the
// glow's own model pass (linear, premultiplied over black: unlit balls are black, rings keep their colour).
render_mode blend_disabled;

uniform sampler2D scene : filter_linear, repeat_disable;
uniform sampler2D model_depth : filter_nearest, repeat_disable;   // R linear depth, G on a model
uniform sampler2D model_color : filter_linear, repeat_disable;
uniform vec2 texel = vec2(1.0);        // 1 / screen size (web uTexel)
uniform float blur_px = 4.0;           // web BLUR_PX
uniform float grad_px = 1.5;           // web GRAD_PX
uniform float thresh = 0.05;           // web DEPTH_THRESH
uniform float gain = 4.0;              // web EDGE_GAIN
uniform float white = 0.15;            // web EDGE_WHITE
uniform float intensity = 0.0;         // web uIntensity

const int K = 8;
const vec2 DISK[8] = vec2[8](
	vec2(1.0, 0.0), vec2(0.7071, 0.7071), vec2(0.0, 1.0), vec2(-0.7071, 0.7071),
	vec2(-1.0, 0.0), vec2(-0.7071, -0.7071), vec2(0.0, -1.0), vec2(0.7071, -0.7071)
);
const float SRGB_KNEE = 0.04045;
const float SRGB_LINEAR_SLOPE = 12.92;
const float SRGB_OFFSET = 0.055;
const float SRGB_SCALE = 1.055;
const float SRGB_GAMMA = 2.4;

vec3 srgb_to_linear(vec3 c) {
	return mix(pow((c + SRGB_OFFSET) / SRGB_SCALE, vec3(SRGB_GAMMA)), c / SRGB_LINEAR_SLOPE,
		vec3(lessThanEqual(c, vec3(SRGB_KNEE))));
}

void fragment() {
	vec4 base = texture(scene, UV);
	vec2 g = texel * grad_px;
	float acc = 0.0;
	vec3 col_acc = vec3(0.0);
	float col_w = 0.0;
	for (int i = 0; i < K; i++) {
		vec2 p = UV + DISK[i] * blur_px * texel;
		vec4 centre = texture(model_depth, p);
		float io = centre.g;
		float zc = centre.r;
		float diff = abs(zc - texture(model_depth, p - vec2(g.x, 0.0)).r)
			+ abs(zc - texture(model_depth, p + vec2(g.x, 0.0)).r)
			+ abs(zc - texture(model_depth, p - vec2(0.0, g.y)).r)
			+ abs(zc - texture(model_depth, p + vec2(0.0, g.y)).r);
		acc += io * smoothstep(thresh, thresh * 2.0, diff);
		col_acc += texture(model_color, p).rgb * io;
		col_w += io;
	}
	float outline = acc / float(K);
	vec3 model_col = col_w > 0.0 ? col_acc / col_w : vec3(1.0);
	vec3 edge_col = mix(model_col, vec3(1.0), white) * gain;
	COLOR = vec4(srgb_to_linear(base.rgb) + outline * edge_col * intensity, base.a);
}
