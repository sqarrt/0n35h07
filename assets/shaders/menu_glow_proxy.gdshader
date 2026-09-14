shader_type spatial;
// Black, opaque stand-in for a menu model in the edge glow's model passes. web MenuEdgeGlow renders the models on their
// own layer, which the menu lights are not on, so the lit balls come out black there; and web enables depthWrite on the
// planet ring, so its whole annulus has depth. The stand-in keeps the `waves` silhouette of the ball it copies.
render_mode unshaded, cull_disabled, shadows_disabled, fog_disabled;

uniform bool waves = false;
uniform float time = 0.0;

#include "res://assets/shaders/ball_waves.gdshaderinc"

void vertex() {
	if (waves) {
		VERTEX = ball_waves(VERTEX, NORMAL, time);
	}
}

void fragment() {
	ALBEDO = vec3(0.0);
}
