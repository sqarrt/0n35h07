shader_type canvas_item;
render_mode blend_premul_alpha;
// One pass of a separable Gaussian over a whole picture — CSS `filter: blur(σ px)` (Chrome's σ in pixels, reaching 3σ).
// The filter blurs premultiplied colour and sees transparency past the element's edges, so samples outside the source
// count as clear. Reads straight or premultiplied colour, writes premultiplied, tinted by the item's modulate (the
// brightness / opacity filters after it).

uniform sampler2D source : filter_nearest, repeat_disable;
uniform vec2 direction = vec2(1.0, 0.0);
uniform float sigma = 0.0;
uniform bool premultiply_source = false;

const int MAX_RADIUS = 32;
const float KERNEL_SIGMAS = 3.0;
const float MIN_SIGMA = 0.05;         // below this the pass copies the source

varying vec4 modulate;

void vertex() {
	modulate = COLOR;
}

vec4 sample_source(vec2 uv) {
	if (any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) {
		return vec4(0.0);
	}
	vec4 c = texture(source, uv);
	if (premultiply_source) {
		c.rgb *= c.a;
	}
	return c;
}

void fragment() {
	vec4 total = vec4(0.0);
	if (sigma < MIN_SIGMA) {
		total = sample_source(UV);
	} else {
		vec2 texel = direction / vec2(textureSize(source, 0));
		int radius = min(int(ceil(sigma * KERNEL_SIGMAS)), MAX_RADIUS);
		float weights = 0.0;
		for (int i = -radius; i <= radius; i++) {
			float x = float(i);
			float w = exp(-0.5 * x * x / (sigma * sigma));
			total += w * sample_source(UV + texel * x);
			weights += w;
		}
		total /= weights;
	}
	COLOR = total * vec4(modulate.rgb * modulate.a, modulate.a);
}
