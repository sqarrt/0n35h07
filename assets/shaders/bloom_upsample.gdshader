shader_type canvas_item;
// One step back up the bloom blur — postprocessing MipmapBlurPass UpsamplingMaterial (convolution.upsampling): a 3×3
// tent of the smaller source (corners 0.0625, sides 0.125, centre 0.25) mixed over the same-size downsampled mip by
// `radius`, written into a float viewport.
render_mode blend_disabled;

uniform sampler2D source : filter_linear, repeat_disable;
uniform sampler2D support : filter_linear, repeat_disable;
uniform vec2 texel = vec2(1.0);        // 1 / source size
uniform float radius = 0.85;

const float CORNER = 0.0625;
const float SIDE = 0.125;
const float CENTRE = 0.25;

void fragment() {
	vec4 c = vec4(0.0);
	c += texture(source, UV + texel * vec2(-1.0, 1.0)) * CORNER;
	c += texture(source, UV + texel * vec2(0.0, 1.0)) * SIDE;
	c += texture(source, UV + texel * vec2(1.0, 1.0)) * CORNER;
	c += texture(source, UV + texel * vec2(-1.0, 0.0)) * SIDE;
	c += texture(source, UV) * CENTRE;
	c += texture(source, UV + texel * vec2(1.0, 0.0)) * SIDE;
	c += texture(source, UV + texel * vec2(-1.0, -1.0)) * CORNER;
	c += texture(source, UV + texel * vec2(0.0, -1.0)) * SIDE;
	c += texture(source, UV + texel * vec2(1.0, -1.0)) * CORNER;
	COLOR = mix(texture(support, UV), c, radius);
}
