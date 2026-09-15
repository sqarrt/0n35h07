shader_type canvas_item;
// canvas 2D `globalCompositeOperation = 'lighter'` into a transparent target: premultiplied colour and alpha both add.
// Godot's add blend weighs colour and alpha by the source alpha, so the fragment carries √a: colour + rgb·a, alpha + a.
render_mode blend_add, unshaded;

void fragment() {
	float weight = sqrt(COLOR.a);
	COLOR = vec4(COLOR.rgb * weight, weight);
}
