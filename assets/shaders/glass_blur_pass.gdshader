shader_type canvas_item;
// The first half of CSS `backdrop-filter: blur(σ px)` under a box (glass.ts): a horizontal Gaussian (σ in pixels, as
// Chrome's filter blur, reaching 3σ) of what was drawn behind the box, read at whole pixels, samples past the box's sides
// mirrored back into it. The screen is copied again after this pass; glass_surface.gdshader adds the vertical half.

uniform sampler2D screen_texture : hint_screen_texture, filter_nearest, repeat_disable;
uniform float sigma = 0.0;
uniform vec2 box_px = vec2(1.0);        // the box size in screen pixels

const int MAX_RADIUS = 96;
const float KERNEL_SIGMAS = 3.0;
const float MIN_SIGMA = 0.05;           // below this the backdrop is kept as is
const float PIXEL_CENTRE = 0.5;

varying vec4 modulate;

void vertex() {
	modulate = COLOR;
}

void fragment() {
	vec3 color = textureLod(screen_texture, SCREEN_UV, 0.0).rgb;
	if (sigma >= MIN_SIGMA) {
		vec2 origin_uv = SCREEN_UV - UV * box_px * SCREEN_PIXEL_SIZE;
		vec2 centre = floor(UV * box_px) + PIXEL_CENTRE;
		int radius = min(int(ceil(sigma * KERNEL_SIGMAS)), MAX_RADIUS);
		vec3 total = vec3(0.0);
		float weights = 0.0;
		for (int dx = -radius; dx <= radius; dx++) {
			float x = box_px.x - abs(box_px.x - abs(centre.x + float(dx)));   // mirrored into the box
			float w = exp(-0.5 * float(dx * dx) / (sigma * sigma));
			total += w * textureLod(screen_texture, origin_uv + vec2(x, centre.y) * SCREEN_PIXEL_SIZE, 0.0).rgb;
			weights += w;
		}
		color = total / weights;
	}
	COLOR = vec4(color, modulate.a);
}
