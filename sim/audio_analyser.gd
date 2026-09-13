class_name AudioAnalyser extends RefCounted
## Spectrum and level of an audio source — port of the Web Audio AnalyserNode as the web game configures it (fftSize
## 256, default smoothing 0.8 and -100 .. -30 dB) and of web AudioAnalysis.ts (analyserLevel, fillBands). Frames are
## down-mixed to mono and kept for the last FFT_SIZE samples; a frequency read applies the Blackman window, the FFT
## (magnitude / N), the time smoothing and the dB-to-byte mapping of the W3C specification.

const FFT_SIZE := 256
const BINS := FFT_SIZE / 2
const SMOOTHING := 0.8
const MIN_DB := -100.0
const MAX_DB := -30.0
const BYTE_MAX := 255
const BYTE_MID := 128.0
const BLACKMAN_A0 := 0.42
const BLACKMAN_A1 := 0.5
const BLACKMAN_A2 := 0.08
const DB_PER_DECADE := 20.0
const MIN_BIN := 1                       # fillBands skips DC
const HALF := 0.5

var _samples := PackedFloat32Array()     # ring buffer of mono samples
var _write := 0
var _smoothed := PackedFloat32Array()
var _window := PackedFloat32Array()

func _init() -> void:
	_samples.resize(FFT_SIZE)
	_smoothed.resize(BINS)
	_window.resize(FFT_SIZE)
	for n in FFT_SIZE:
		_window[n] = BLACKMAN_A0 - BLACKMAN_A1 * cos(TAU * n / FFT_SIZE) + BLACKMAN_A2 * cos(2.0 * TAU * n / FFT_SIZE)

## Feed stereo frames (AudioEffectCapture.get_buffer); each is down-mixed to (L + R) / 2.
func push_frames(frames: PackedVector2Array) -> void:
	for frame in frames:
		_samples[_write] = (frame.x + frame.y) * HALF
		_write = (_write + 1) % FFT_SIZE

## getByteTimeDomainData: floor(128 * (1 + x)) clamped to a byte, oldest sample first.
func time_domain_bytes() -> PackedByteArray:
	var bytes := PackedByteArray()
	bytes.resize(FFT_SIZE)
	for i in FFT_SIZE:
		bytes[i] = clampi(floori(BYTE_MID * (1.0 + _samples[(_write + i) % FFT_SIZE])), 0, BYTE_MAX)
	return bytes

## web analyserLevel: RMS 0..1 of the byte time-domain signal.
func level() -> float:
	var sum_sq := 0.0
	for byte in time_domain_bytes():
		var x := (byte - BYTE_MID) / BYTE_MID
		sum_sq += x * x
	return sqrt(sum_sq / FFT_SIZE)

## getByteFrequencyData: one smoothing step per read, as the web AudioBar reads once per frame.
func frequency_bytes() -> PackedByteArray:
	var re := PackedFloat32Array()
	var im := PackedFloat32Array()
	re.resize(FFT_SIZE)
	im.resize(FFT_SIZE)
	for i in FFT_SIZE:
		re[i] = _samples[(_write + i) % FFT_SIZE] * _window[i]
	_fft(re, im)
	var bytes := PackedByteArray()
	bytes.resize(BINS)
	var scale := BYTE_MAX / (MAX_DB - MIN_DB)
	for k in BINS:
		var magnitude := sqrt(re[k] * re[k] + im[k] * im[k]) / FFT_SIZE
		_smoothed[k] = SMOOTHING * _smoothed[k] + (1.0 - SMOOTHING) * magnitude
		var db := DB_PER_DECADE * log(_smoothed[k]) / log(10.0) if _smoothed[k] > 0.0 else -INF
		bytes[k] = clampi(floori(scale * (db - MIN_DB)), 0, BYTE_MAX) if db > -INF else 0
	return bytes

## web fillBands: bins spread over `out.size()` bands on a log scale, max-combined into what `out` already holds.
static func fill_bands(frequency: PackedByteArray, out: PackedFloat32Array) -> void:
	var total := frequency.size()
	var n := out.size()
	for i in n:
		var lo := floori(MIN_BIN * pow(float(total) / MIN_BIN, float(i) / n))
		var hi := maxi(lo + 1, floori(MIN_BIN * pow(float(total) / MIN_BIN, float(i + 1) / n)))
		var peak := 0
		for j in range(lo, mini(hi, total)):
			peak = maxi(peak, frequency[j])
		out[i] = maxf(out[i], float(peak) / BYTE_MAX)

## In-place iterative radix-2 FFT (FFT_SIZE is a power of two).
static func _fft(re: PackedFloat32Array, im: PackedFloat32Array) -> void:
	var n := re.size()
	var j := 0
	for i in range(1, n):
		var bit := n >> 1
		while j & bit:
			j ^= bit
			bit >>= 1
		j |= bit
		if i < j:
			var t := re[i]
			re[i] = re[j]
			re[j] = t
			t = im[i]
			im[i] = im[j]
			im[j] = t
	var length := 2
	while length <= n:
		var angle := -TAU / length
		var w_re := cos(angle)
		var w_im := sin(angle)
		for start in range(0, n, length):
			var u_re := 1.0
			var u_im := 0.0
			for k in length / 2:
				var a := start + k
				var b := a + length / 2
				var v_re := re[b] * u_re - im[b] * u_im
				var v_im := re[b] * u_im + im[b] * u_re
				re[b] = re[a] - v_re
				im[b] = im[a] - v_im
				re[a] += v_re
				im[a] += v_im
				var next_re := u_re * w_re - u_im * w_im
				u_im = u_re * w_im + u_im * w_re
				u_re = next_re
		length <<= 1
