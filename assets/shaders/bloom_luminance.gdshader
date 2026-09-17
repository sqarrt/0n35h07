shader_type canvas_item;
// Bloom's bright-pass — postprocessing LuminancePass with LuminanceMaterial (colour output, threshold): each texel
// kept in proportion to smoothstep(threshold, threshold + smoothing, luminance), alpha included, into a float viewport.
// Luminance weights: three.js WebGLProgram luminance() for the linear sRGB working space.
render_mode blend_disabled;

uniform sampler2D source : filter_linear, repeat_disable;
uniform float threshold = 1.0;
uniform float smoothing = 0.03;

const vec3 LUMINANCE_WEIGHTS = vec3(0.2126, 0.7152, 0.0722);

void fragment() {
	vec4 texel = texture(source, UV);
	COLOR = texel * smoothstep(threshold, threshold + smoothing, dot(LUMINANCE_WEIGHTS, texel.rgb));
}
