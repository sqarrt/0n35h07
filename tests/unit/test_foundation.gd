extends GutTest
## Foundation smoke tests — pin the invariants the rest of the rewrite builds on.

const REQUIRED_ACTIONS := [
	"move_fwd", "move_back", "move_left", "move_right",
	"jump", "fire", "ability", "pause",
]

func test_game_autoload_exists() -> void:
	assert_not_null(Game, "Game autoload should be registered")

func test_game_version_matches_release() -> void:
	assert_eq(Game.GAME_VERSION, "2.0.0", "GAME_VERSION should match release 2.0.0")

func test_all_input_actions_registered() -> void:
	for action in REQUIRED_ACTIONS:
		assert_true(InputMap.has_action(action), "missing input action: " + action)
