// CSS box maths shared by the box-shadow shaders: the Gaussian blur of a rectangle is a product of normal-CDF
// differences per axis (sigma = blur / 2), and a box edge keeps partial pixel coverage for fractional sizes.

const float SQRT2 = 1.41421356;
// Abramowitz & Stegun 7.1.26 erf approximation (|error| < 1.5e-7).
const float ERF_P = 0.3275911;
const float ERF_A1 = 0.254829592;
const float ERF_A2 = -0.284496736;
const float ERF_A3 = 1.421413741;
const float ERF_A4 = -1.453152027;
const float ERF_A5 = 1.061405429;
const float HALF_PIXEL = 0.5;

float erf_approx(float x) {
	float s = sign(x);
	float a = abs(x);
	float t = 1.0 / (1.0 + ERF_P * a);
	float y = 1.0 - (((((ERF_A5 * t + ERF_A4) * t) + ERF_A3) * t + ERF_A2) * t + ERF_A1) * t * exp(-a * a);
	return s * y;
}

float cdf(float t) {
	return 0.5 * (1.0 + erf_approx(t / SQRT2));
}

// Share of a [lo, hi] span blurred by `sigma` reaching coordinate p.
float blurred_span(float p, float lo, float hi, float sigma) {
	return cdf((hi - p) / sigma) - cdf((lo - p) / sigma);
}

// Share of the pixel centred on p covered by [lo, hi].
float pixel_span(float p, float lo, float hi) {
	return clamp(min(p + HALF_PIXEL, hi) - max(p - HALF_PIXEL, lo), 0.0, 1.0);
}

vec4 over(vec4 src, vec4 dst) {
	float a = src.a + dst.a * (1.0 - src.a);
	vec3 rgb = a > 0.0 ? (src.rgb * src.a + dst.rgb * dst.a * (1.0 - src.a)) / a : vec3(0.0);
	return vec4(rgb, a);
}
