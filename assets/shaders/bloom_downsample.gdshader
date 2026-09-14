shader_type canvas_item;
// One mip of the bloom blur — postprocessing MipmapBlurPass DownsamplingMaterial (convolution.downsampling): a 13-tap
// filter of the bigger source (4 inner taps at ±1 texel weighted 0.125, 9 outer at 0 / ±2 weighted 0.05556), taps
// outside the source contributing nothing, written into a half-size float viewport.
render_mode blend_disabled;

uniform sampler2D source : filter_linear, repeat_disable;
uniform vec2 texel = vec2(1.0);        // 1 / source size

const float WEIGHT_INNER = 0.125;
const float WEIGHT_OUTER = 0.05556;
const vec2 INNER[4] = vec2[4](vec2(-1.0, 1.0), vec2(1.0, 1.0), vec2(-1.0, -1.0), vec2(1.0, -1.0));
const vec2 OUTER[8] = vec2[8](vec2(-2.0, 2.0), vec2(0.0, 2.0), vec2(2.0, 2.0), vec2(-2.0, 0.0),
	vec2(2.0, 0.0), vec2(-2.0, -2.0), vec2(0.0, -2.0), vec2(2.0, -2.0));

float inside(vec2 uv) {
	return float(uv.x >= 0.0 && uv.x <= 1.0 && uv.y >= 0.0 && uv.y <= 1.0);
}

void fragment() {
	vec4 c = vec4(0.0);
	for (int i = 0; i < 4; i++) {
		vec2 uv = UV + texel * INNER[i];
		c += WEIGHT_INNER * inside(uv) * texture(source, uv);
	}
	for (int i = 0; i < 8; i++) {
		vec2 uv = UV + texel * OUTER[i];
		c += WEIGHT_OUTER * inside(uv) * texture(source, uv);
	}
	c += WEIGHT_OUTER * texture(source, UV);
	COLOR = c;
}
