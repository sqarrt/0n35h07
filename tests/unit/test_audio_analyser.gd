extends GutTest
## AnalyserNode / AudioAnalysis / AudioBar parity: W3C byte mapping of an exact-bin sine (first smoothed read and the
## converged value), time-domain level, the web log band ranges and the AudioBar attack / decay and geometry.

const EPS := 0.001
const SINE_BIN := 16
const QUIET_AMP := 0.01
const CONVERGE_READS := 80

func _sine(amplitude: float) -> PackedVector2Array:
	var frames := PackedVector2Array()
	for n in AudioAnalyser.FFT_SIZE:
		var x := amplitude * sin(TAU * SINE_BIN * n / AudioAnalyser.FFT_SIZE)
		frames.append(Vector2(x, x))
	return frames

func _expected_byte(magnitude: float) -> int:
	var db := 20.0 * log(magnitude) / log(10.0)
	return floori(255.0 / 70.0 * (db + 100.0))

func test_an_exact_bin_sine_maps_like_the_specification() -> void:
	var analyser := AudioAnalyser.new()
	analyser.push_frames(_sine(QUIET_AMP))
	var peak := QUIET_AMP * AudioAnalyser.BLACKMAN_A0 * 0.5   # Blackman coherent gain, one-sided / N
	assert_eq(analyser.frequency_bytes()[SINE_BIN], _expected_byte(peak * 0.2), "first read: 20% of the magnitude")
	var bytes := PackedByteArray()
	for i in CONVERGE_READS:
		bytes = analyser.frequency_bytes()
	assert_eq(bytes[SINE_BIN], _expected_byte(peak), "smoothing converges to the magnitude")
	assert_eq(bytes[SINE_BIN + 5], 0, "far bins stay below -100 dB")

func test_level_of_silence_and_a_full_scale_sine() -> void:
	var analyser := AudioAnalyser.new()
	assert_almost_eq(analyser.level(), 0.0, EPS)
	analyser.push_frames(_sine(1.0))
	assert_almost_eq(analyser.level(), sqrt(0.5), 0.01, "RMS of a sine")

func test_log_bands_take_the_web_bin_ranges() -> void:
	var frequency := PackedByteArray()
	frequency.resize(AudioAnalyser.BINS)
	frequency[1] = 51
	frequency[11] = 102
	frequency[12] = 255
	frequency[127] = 204
	var out := PackedFloat32Array()
	out.resize(AudioBarModel.BANDS)
	AudioAnalyser.fill_bands(frequency, out)
	assert_almost_eq(out[0], 0.2, EPS, "band 0 = bin 1")
	assert_almost_eq(out[20], 0.4, EPS, "band 20 = bin 11 only")
	assert_almost_eq(out[39], 0.8, EPS, "band 39 = bins 113..127")
	var louder := PackedFloat32Array(out)
	louder[0] = 0.9
	AudioAnalyser.fill_bands(frequency, louder)
	assert_almost_eq(louder[0], 0.9, EPS, "max-combined with another source")

func test_audio_bar_attack_decay_and_line() -> void:
	var bar := AudioBarModel.new()
	var raw := PackedFloat32Array()
	raw.resize(AudioBarModel.BANDS)
	raw[0] = 0.5
	bar.step(raw)
	assert_almost_eq(bar.values()[0], 0.7 * AudioBarModel.SMOOTH_UP, EPS, "gain 1.4, fast attack")
	raw[0] = 0.0
	bar.step(raw)
	assert_almost_eq(bar.values()[0], 0.385 * (1.0 - AudioBarModel.SMOOTH_DOWN), EPS, "slow decay")
	var line := bar.points(Vector2(600.0, 42.0))
	assert_eq(line.size(), AudioBarModel.BANDS * 2 - 1)
	assert_almost_eq(line[AudioBarModel.BANDS - 1].x, 300.0, EPS, "bass in the centre")
	assert_almost_eq(line[0].y, 89.0 / 90.0 * 42.0, EPS, "silent highs rest on the bottom")
