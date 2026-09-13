shader_type canvas_item;
// One pass of a separable Gaussian blur over the source alpha, painted in `tint` — a CSS text-shadow glow.
// GlowText runs it twice: horizontally into a SubViewport, then vertically on screen from that viewport.
// sigma = CSS blur radius / 2 (CssShadow); the kernel reaches 3 sigma.

uniform vec2 direction = vec2(1.0, 0.0);
uniform float sigma = 0.0;
uniform vec4 tint : source_color = vec4(1.0);

const int MAX_RADIUS = 96;
const float KERNEL_SIGMAS = 3.0;
const float MIN_SIGMA = 0.05;         // below this the blur is the source itself

varying vec4 modulate;

void vertex() {
	modulate = COLOR;
}

void fragment() {
	float alpha;
	if (sigma < MIN_SIGMA) {
		alpha = texture(TEXTURE, UV).a;
	} else {
		int radius = min(int(ceil(sigma * KERNEL_SIGMAS)), MAX_RADIUS);
		vec2 step_uv = TEXTURE_PIXEL_SIZE * direction;
		float total = 0.0;
		float weights = 0.0;
		for (int i = -radius; i <= radius; i++) {
			float x = float(i);
			float w = exp(-0.5 * x * x / (sigma * sigma));
			total += w * texture(TEXTURE, UV + step_uv * x).a;
			weights += w;
		}
		alpha = total / weights;
	}
	COLOR = vec4(tint.rgb * modulate.rgb, tint.a * alpha * modulate.a);
}
