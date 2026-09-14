shader_type canvas_item;
// Composites a transparent 3D SubViewport the way a WebGL canvas with premultipliedAlpha does: the viewport stores
// translucent pixels already multiplied by their alpha (c·a over the cleared background), so they go over the page
// as rgb + dst·(1 − a). Straight blend_mix would multiply by alpha a second time and darken them (the menu planet
// ring, fading balls).
render_mode blend_premul_alpha;

void fragment() {
	COLOR = texture(TEXTURE, UV);
}
