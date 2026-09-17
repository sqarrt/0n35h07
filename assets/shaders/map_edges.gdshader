shader_type spatial;
// Map edge outline — web EdgeOutline.tsx EdgeEffect as a full-screen quad drawn last: a normal discontinuity between
// neighbouring pixels of the block pass, only where that block is the visible surface, lightens the frame
//   edge = isBlock * visible * smoothstep(threshold, 2 * threshold, dN),  colour = mix(c, gain * c, edge)
// applied by multiplying the frame with 1 + (gain - 1) * edge (web also clamps gain * c to 1; blocks are dark).
render_mode unshaded, fog_disabled, blend_mul, depth_test_disabled, depth_draw_never, cull_disabled, shadows_disabled;

uniform sampler2D block_normals : filter_nearest, repeat_disable;
uniform sampler2D depth_texture : hint_depth_texture, filter_nearest, repeat_disable;
uniform float thickness = 1.0;        // sampling offset in screen pixels
uniform float threshold = 0.1;        // on the summed neighbour normal distances
uniform float gain = 2.0;             // how much lighter an edge gets
uniform float depth_eps = 0.15;       // world units the scene may be in front of the block before it hides the edge

const vec3 CLEAR_NORMAL = vec3(119.0 / 255.0, 119.0 / 255.0, 1.0);   // NormalPass clear colour #7777ff
const float BYTE = 255.0;             // the web normal target is RGBA8
const float HALF = 0.5;
const float TWO = 2.0;

void vertex() {
	POSITION = vec4(VERTEX.xy, 1.0, 1.0);
}

vec3 packed_normal(vec2 uv) {
	vec4 texel = texture(block_normals, uv);
	if (texel.b <= 0.0) {
		return CLEAR_NORMAL;
	}
	vec2 xy = texel.rg * TWO - 1.0;
	float z = sqrt(max(0.0, 1.0 - dot(xy, xy)));
	return round(vec3(texel.rg, z * HALF + HALF) * BYTE) / BYTE;
}

void fragment() {
	vec2 offset = thickness / VIEWPORT_SIZE;
	vec3 n = packed_normal(SCREEN_UV);
	float dn = distance(n, packed_normal(SCREEN_UV - vec2(offset.x, 0.0)))
		+ distance(n, packed_normal(SCREEN_UV + vec2(offset.x, 0.0)))
		+ distance(n, packed_normal(SCREEN_UV - vec2(0.0, offset.y)))
		+ distance(n, packed_normal(SCREEN_UV + vec2(0.0, offset.y)));
	float block_depth = texture(block_normals, SCREEN_UV).b;
	float is_block = block_depth > 0.0 ? 1.0 : 0.0;
	float depth = texture(depth_texture, SCREEN_UV).r;
	vec4 view = INV_PROJECTION_MATRIX * vec4(SCREEN_UV * TWO - 1.0, depth, 1.0);
	float scene_z = view.z / view.w;
	float visible = step(scene_z + block_depth, depth_eps);
	float edge = is_block * visible * smoothstep(threshold, threshold * TWO, dn);
	ALBEDO = vec3(1.0 + (gain - 1.0) * edge);
}
