shader_type canvas_item;
// CSS `backdrop-filter: blur(σ px)` under a box: a Gaussian (σ in pixels, as Chrome's filter blur, reaching 3σ) of what
// was drawn behind the box, read from the screen at whole pixels; samples past the box's edges mirror back into it,
// as Chrome reads the backdrop only inside the element. The box's own background is drawn on top by the next item.

uniform sampler2D screen_texture : hint_screen_texture, filter_nearest, repeat_disable;
uniform float sigma = 0.0;
uniform vec2 box_px = vec2(1.0);        // the box size in screen pixels

const int MAX_RADIUS = 24;
const float KERNEL_SIGMAS = 3.0;
const float MIN_SIGMA = 0.05;           // below this the backdrop is shown as is
const float PIXEL_CENTRE = 0.5;

void fragment() {
	if (sigma < MIN_SIGMA) {
		COLOR = textureLod(screen_texture, SCREEN_UV, 0.0);
	} else {
		vec2 origin_uv = SCREEN_UV - UV * box_px * SCREEN_PIXEL_SIZE;
		vec2 centre = floor(UV * box_px) + PIXEL_CENTRE;
		int radius = min(int(ceil(sigma * KERNEL_SIGMAS)), MAX_RADIUS);
		vec4 total = vec4(0.0);
		float weights = 0.0;
		for (int dy = -radius; dy <= radius; dy++) {
			for (int dx = -radius; dx <= radius; dx++) {
				vec2 offset = vec2(float(dx), float(dy));
				vec2 p = box_px - abs(box_px - abs(centre + offset));   // mirrored into the box
				float w = exp(-0.5 * dot(offset, offset) / (sigma * sigma));
				total += w * textureLod(screen_texture, origin_uv + p * SCREEN_PIXEL_SIZE, 0.0);
				weights += w;
			}
		}
		COLOR = total / weights;
	}
}
