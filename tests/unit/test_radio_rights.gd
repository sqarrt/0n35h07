extends GutTest
## RadioRights — web App's radio entitlement state: ownership starts from the profile's cached Steam answer (unresolved
## without one, so no trial strip flashes for owners), Steam's answer settles and caches it, each generated track and
## each save counts against today's trial, and the unlock offer shows only on the trial.

const TODAY := "2026-06-28"
const YESTERDAY := "2026-06-27"

func test_ownership_starts_from_the_cached_answer() -> void:
	var cached := RadioRights.new({RadioRights.KEY_OWNED: true})
	assert_true(cached.owned)
	assert_true(cached.resolved, "a cached answer is known")
	var fresh := RadioRights.new({})
	assert_false(fresh.owned)
	assert_false(fresh.resolved, "no answer yet")

func test_steams_answer_settles_and_caches_ownership() -> void:
	var profile := {}
	var rights := RadioRights.new(profile)
	watch_signals(rights)
	rights.resolve(profile, true)
	assert_true(rights.owned)
	assert_true(rights.resolved)
	assert_eq(profile[RadioRights.KEY_OWNED], true)
	assert_signal_emitted(rights, "changed")

func test_a_recheck_updates_ownership_but_does_not_resolve() -> void:
	var profile := {}
	var rights := RadioRights.new(profile)
	rights.recheck(profile, true)
	assert_true(rights.owned)
	assert_false(rights.resolved, "web: only the warm-up answer resolves")
	assert_eq(profile[RadioRights.KEY_OWNED], true)

func test_the_same_answer_changes_nothing() -> void:
	var profile := {RadioRights.KEY_OWNED: false}
	var rights := RadioRights.new(profile)
	watch_signals(rights)
	rights.resolve(profile, false)
	assert_signal_not_emitted(rights, "changed")

func test_generations_count_against_todays_trial() -> void:
	var profile := {RadioRights.KEY_TRIAL: {"day": YESTERDAY, "gens": 9, "saves": 4}}
	var rights := RadioRights.new(profile)
	rights.note_generated(profile, TODAY)
	assert_eq(profile[RadioRights.KEY_TRIAL], {"day": TODAY, "gens": 1, "saves": 0}, "a new day starts over")
	for i in RadioEntitlement.FREE_GENS_PER_DAY - 1:
		rights.note_generated(profile, TODAY)
	assert_false(rights.entitlement(profile, TODAY)["can_generate"], "the daily quota is spent")
	assert_true(rights.entitlement(profile, "2026-06-29")["can_generate"], "tomorrow it is back")

func test_saves_count_against_todays_trial() -> void:
	var profile := {}
	var rights := RadioRights.new(profile)
	watch_signals(rights)
	rights.note_saved(profile, TODAY)
	assert_eq(profile[RadioRights.KEY_TRIAL], {"day": TODAY, "gens": 0, "saves": 1})
	assert_signal_emitted(rights, "changed")

func test_owners_and_dev_runs_are_unlimited() -> void:
	var spent := {RadioRights.KEY_TRIAL: {"day": TODAY, "gens": 10, "saves": 5}}
	assert_true(RadioRights.new(spent, true).entitlement(spent, TODAY)["can_generate"], "dev")
	var owner := RadioRights.new(spent)
	owner.resolve(spent, true)
	assert_true(owner.entitlement(spent, TODAY)["can_save"])

func test_the_trial_strip_shows_only_on_a_resolved_trial() -> void:
	var profile := {RadioRights.KEY_TRIAL: {"day": TODAY, "gens": 3, "saves": 1}}
	var rights := RadioRights.new(profile)
	assert_eq(rights.trial_strip(profile, TODAY), {}, "unresolved: no strip")
	rights.resolve(profile, false)
	assert_eq(rights.trial_strip(profile, TODAY), {"gens_left": 7, "saves_left": 4})
	rights.resolve(profile, true)
	assert_eq(rights.trial_strip(profile, TODAY), {}, "owned: no strip")

func test_the_unlock_offer_is_for_the_trial_only() -> void:
	var profile := {}
	assert_true(RadioRights.new(profile).can_unlock())
	assert_false(RadioRights.new(profile, true).can_unlock(), "dev")
	var owner := RadioRights.new(profile)
	owner.resolve(profile, true)
	assert_false(owner.can_unlock())
