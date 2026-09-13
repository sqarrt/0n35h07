extends GutTest
## Beam skin maths parity with web ClassicBeamFx (radial shrink + afterglow), RageBeamFx (stepped fade, thickness
## pulse, segment layout) and SingularityBeamFx (retract, shrinking spiral) and their lateral axes.

const EPS := 0.001

func test_classic_shrinks_radially_and_leaves_an_afterglow() -> void:
	assert_almost_eq(BeamCurves.classic_width(0.25), 0.75, EPS, "scale (1 - t, len, 1 - t)")
	assert_almost_eq(BeamCurves.afterglow_step(BeamCurves.AFTERGLOW_INITIAL, 0.1), 0.32, EPS, "energy -= dt * 1.8")
	assert_almost_eq(BeamCurves.afterglow_opacity(0.5), 0.2, EPS, "energy * 0.4")

func test_rage_fades_in_ragged_steps_and_pulses() -> void:
	assert_almost_eq(BeamCurves.rage_level(0.1), 1.0, EPS)
	assert_almost_eq(BeamCurves.rage_level(0.5), 0.35, EPS)
	assert_almost_eq(BeamCurves.rage_level(0.7), 0.8, EPS)
	assert_almost_eq(BeamCurves.rage_level(0.95), 0.1, EPS)
	assert_almost_eq(BeamCurves.rage_pulse(1.0 / (4.0 * BeamCurves.RAGE_PULSE_HZ)), 1.2, EPS, "+20% at the sine peak")
	assert_eq(BeamCurves.rage_segment_center(Vector3.ZERO, Vector3(0, 0, -7), 0), Vector3(0, 0, -0.5))
	assert_almost_eq(BeamCurves.rage_segment_length(7.0), 0.8, EPS, "len / 7 * 0.8")

func test_singularity_retracts_and_coils_in() -> void:
	assert_almost_eq(BeamCurves.singularity_retract(0.35), 0.0, EPS)
	assert_almost_eq(BeamCurves.singularity_retract(0.675), 0.5, EPS)
	assert_almost_eq(BeamCurves.spiral_radius(0.0), 0.35, EPS)
	assert_almost_eq(BeamCurves.spiral_radius(1.0), 0.14, EPS, "shrinks by 60%")
	var axes := BeamCurves.side_axes(Vector3(0, 0, -1))
	assert_true((axes[0] as Vector3).is_equal_approx(Vector3(1, 0, 0)), "dir x UP")
	assert_true((axes[1] as Vector3).is_equal_approx(Vector3(0, -1, 0)), "dir x side1")
	assert_true((BeamCurves.side_axes(Vector3.UP)[0] as Vector3).is_equal_approx(Vector3(1, 0, 0)), "vertical beam -> X")
	var p := BeamCurves.spiral_point(0, 0.0, 10.0, 0.35, Vector3.ZERO, Vector3(0, 0, -1), axes[0], axes[1])
	assert_true(p.is_equal_approx(Vector3(0.35, 0, 0)), "particle 0 at the muzzle on side1")
