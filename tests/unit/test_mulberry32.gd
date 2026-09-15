extends GutTest
## Mulberry32 — the web parity hooks' seeded random, value for value with JavaScript (node: mulberry32(7) and
## mulberry32(123456789)).

const EPS := 1e-12
const SEED := 7
const SEED_VALUES := [0.011704753153026104, 0.06195825757458806, 0.97690763277933, 0.6990287057124078,
	0.5214452685322613, 0.4055216880515218]
const BIG_SEED := 123456789
const BIG_SEED_VALUES := [0.2577907438389957, 0.9707721115555614, 0.7853280142880976]

func test_the_sequence_matches_javascript() -> void:
	var random := Mulberry32.new(SEED)
	for value in SEED_VALUES:
		assert_almost_eq(random.next(), value, EPS)
	var big := Mulberry32.new(BIG_SEED)
	for value in BIG_SEED_VALUES:
		assert_almost_eq(big.next(), value, EPS)
