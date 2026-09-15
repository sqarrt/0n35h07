extends GutTest
## AudioAnalysisHub's readers — web AudioAnalysis addReader / addBandReader: a level read joins the loudest-source
## maximum; a band reader max-combines itself into any band count asked of fill_bands and into the hub's own bands.

const EPS := 0.0001
const BEAT_BANDS := 8

func test_a_level_reader_joins_the_maximum() -> void:
	var hub := AudioAnalysisHub.new()
	var reader := func() -> float: return 0.4
	hub.add_level_reader(reader)
	hub.update()
	assert_almost_eq(hub.level(), 0.4, EPS)
	hub.remove_level_reader(reader)
	hub.update()
	assert_almost_eq(hub.level(), 0.0, EPS)

func test_a_band_reader_fills_the_bands_asked_for() -> void:
	var hub := AudioAnalysisHub.new()
	var reader := func(out: PackedFloat32Array) -> void:
		if out.size() == BEAT_BANDS:
			out[0] = maxf(out[0], 0.7)
	hub.add_band_reader(reader)
	hub.update()
	var beat := PackedFloat32Array()
	beat.resize(BEAT_BANDS)
	beat.fill(0.9)
	hub.fill_bands(beat)
	assert_almost_eq(beat[0], 0.7, EPS, "cleared, then the reader's bands")
	assert_almost_eq(beat[1], 0.0, EPS)
