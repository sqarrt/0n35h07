// The `waves` ball model's travelling vertex waves along the normal — web ballMaterial wavesGLSL. Shared by the ball
// and its stand-ins (the menu glow's model pass), so every copy of a wavy ball has the same silhouette.

const float BALL_RADIUS = 0.5;
const float WAVE_COUNT = 10.0;
const float WAVE_AMP = 0.03;
const float WAVE_SPEED = 3.0;

vec3 ball_waves(vec3 vertex, vec3 normal, float clock) {
	return vertex + normal * WAVE_AMP * sin(WAVE_COUNT * PI / BALL_RADIUS * vertex.y + clock * WAVE_SPEED);
}
