shader_type canvas_item;
// The menu backdrop on screen, composited the way a WebGL canvas with premultipliedAlpha is: the stored colour is
// already multiplied by alpha, so it goes over the page as rgb + dst·(1 − a) (straight blending would darken the
// translucent planet ring and fading balls). Unlit: the backdrop viewport (linear float) encoded. Lit (web MenuEdgeGlow): the edge
// buffer screen-blended with the bloom (postprocessing BlendFunction.SCREEN: d + s − min(d·s, 1), alpha max), alpha
// clamped, linear light encoded to sRGB (three sRGBTransferOETF).
render_mode blend_premul_alpha;

uniform bool lit = false;
uniform sampler2D edge : filter_nearest, repeat_disable;
uniform sampler2D bloom : filter_linear, repeat_disable;
uniform float bloom_intensity = 1.0;

const float SRGB_KNEE = 0.0031308;
const float SRGB_LINEAR_SLOPE = 12.92;
const float SRGB_OFFSET = 0.055;
const float SRGB_SCALE = 1.055;
const float SRGB_INV_GAMMA = 0.41666;

vec3 linear_to_srgb(vec3 c) {
	return mix(pow(c, vec3(SRGB_INV_GAMMA)) * SRGB_SCALE - vec3(SRGB_OFFSET), c * SRGB_LINEAR_SLOPE,
		vec3(lessThanEqual(c, vec3(SRGB_KNEE))));
}

void fragment() {
	if (!lit) {
		vec4 scene = texture(TEXTURE, UV);   // the backdrop viewport is linear float (HDR 2D)
		COLOR = vec4(linear_to_srgb(clamp(scene.rgb, vec3(0.0), vec3(1.0))), clamp(scene.a, 0.0, 1.0));
	} else {
		vec4 d = texture(edge, UV);
		vec4 s = texture(bloom, UV) * bloom_intensity;
		vec3 c = d.rgb + s.rgb - min(d.rgb * s.rgb, vec3(1.0));
		COLOR = vec4(linear_to_srgb(max(c, vec3(0.0))), clamp(max(d.a, s.a), 0.0, 1.0));
	}
}
