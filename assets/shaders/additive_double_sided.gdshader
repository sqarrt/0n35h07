shader_type spatial;
// A double-sided additive surface with per-instance opacity — web MeshBasicMaterial({ transparent, depthWrite: false,
// blending: AdditiveBlending, side: DoubleSide }): wave dash rings and hex shield tiles.
render_mode unshaded, blend_add, depth_draw_never, cull_disabled, shadows_disabled;

uniform vec4 color : source_color = vec4(1.0);
instance uniform float opacity = 0.0;

void fragment() {
	ALBEDO = color.rgb;
	ALPHA = opacity;
}
