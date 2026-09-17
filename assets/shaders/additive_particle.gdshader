shader_type spatial;
// A fading particle — web MeshBasicMaterial({ transparent, depthWrite: false, blending: AdditiveBlending }) in the
// particle colour; each instance carries its own opacity (SpritePool / DeathBurst fade by life).
render_mode unshaded, blend_add, depth_draw_never, shadows_disabled;

uniform vec4 color : source_color = vec4(1.0);
instance uniform float opacity = 0.0;

void fragment() {
	ALBEDO = color.rgb;
	ALPHA = opacity;
}
