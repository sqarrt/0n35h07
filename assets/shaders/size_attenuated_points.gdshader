shader_type spatial;
// Square point sprites — web THREE.PointsMaterial({ size, sizeAttenuation: true, transparent, depthWrite: false,
// blending: AdditiveBlending }) on a point mesh: the pixel size is size * (viewport height / 2) / view depth.
render_mode unshaded, blend_add, depth_draw_never, cull_disabled, shadows_disabled;

uniform vec4 color : source_color = vec4(1.0);
uniform float size = 1.0;
uniform float opacity = 0.0;

const float HALF = 0.5;

void vertex() {
	vec4 view_position = MODELVIEW_MATRIX * vec4(VERTEX, 1.0);
	POINT_SIZE = size * VIEWPORT_SIZE.y * HALF / -view_position.z;
}

void fragment() {
	ALBEDO = color.rgb;
	ALPHA = opacity;
}
