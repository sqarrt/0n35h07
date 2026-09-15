extends GutTest
## SystemFontMetrics — the OS/2 line metrics Chrome lays a line with, read from a font file: the project's Share Tech Mono
## face (winAscent 885, winDescent 242 per 1000, no USE_TYPO_METRICS) and nothing for a file that is not there.

const EPS := 0.0001
const FACE := "res://assets/fonts/share-tech-mono-cyrillic.ttf"

func test_a_font_files_win_metrics_in_em() -> void:
	var metrics := SystemFontMetrics.file_em(FACE)
	assert_almost_eq(float(metrics[SystemFontMetrics.ASCENT]), 0.885, EPS)
	assert_almost_eq(float(metrics[SystemFontMetrics.DESCENT]), 0.242, EPS)

func test_nothing_without_a_file() -> void:
	assert_eq(SystemFontMetrics.file_em(""), {})
	assert_eq(SystemFontMetrics.file_em("res://assets/fonts/missing.ttf"), {})
	assert_eq(SystemFontMetrics.file_face("res://assets/fonts/missing.ttf"), SystemFontMetrics.NO_FACE)

func test_a_single_face_file_is_face_zero() -> void:
	assert_eq(SystemFontMetrics.file_face(FACE, "Share Tech Mono"), 0)

func test_a_family_without_a_collection_face_stays_a_system_font() -> void:
	assert_true(UiFont.system_face(["No Such Family 7"]) is SystemFont, "only a later collection face is opened by index")
