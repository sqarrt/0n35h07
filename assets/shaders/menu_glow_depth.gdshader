shader_type spatial;
// Model depth pass of the menu edge glow — web MenuEdgeGlow ObjDepthPass: a full-screen quad drawn last in the glow's
// depth viewport (same world and camera as the backdrop, no MSAA, float target) turns the depth buffer into
// R = linear view depth (world units, web getViewZ) and G = 1 on a model (web: depth < 0.9999; Godot's reversed Z
// clears to 0). Opaque over whatever the pass drew.
render_mode unshaded, fog_disabled, blend_mix, depth_test_disabled, depth_draw_never, cull_disabled, shadows_disabled;

uniform sampler2D depth_texture : hint_depth_texture, filter_nearest, repeat_disable;

const float CLEARED_DEPTH = 0.0;
const float TWO = 2.0;

void vertex() {
	POSITION = vec4(VERTEX.xy, 1.0, 1.0);
}

void fragment() {
	float depth = texture(depth_texture, SCREEN_UV).r;
	vec4 view = INV_PROJECTION_MATRIX * vec4(SCREEN_UV * TWO - 1.0, depth, 1.0);
	ALBEDO = vec3(-view.z / view.w, depth > CLEARED_DEPTH ? 1.0 : 0.0, 0.0);
	ALPHA = 1.0;
}
