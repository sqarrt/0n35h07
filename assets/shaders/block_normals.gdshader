shader_type spatial;
// Block pass of the map edge outline — web postprocessing NormalPass (MeshNormalMaterial over BLOCK_LAYER only), drawn
// by MapEdges into a float SubViewport: RG = the view-space normal packed n * 0.5 + 0.5, B = the linear view depth
// (the transparent background keeps 0 there for "no block"). Opaque like the web override material, so see-through
// blocks are in the pass too.
render_mode unshaded, cull_back, shadows_disabled, fog_disabled;

const float HALF = 0.5;

void fragment() {
	vec3 n = normalize(NORMAL);
	ALBEDO = vec3(n.xy * HALF + HALF, -VERTEX.z);
}
