"""When the engine runs the site's planner again on its own."""

from worker import REPLAN_EVERY_S, replan_due


def test_plans_at_the_first_idle_moment_of_a_run():
    assert replan_due(None, 5.0)


def test_plans_again_only_a_day_later():
    assert not replan_due(100.0, 100.0 + 3600)
    assert not replan_due(100.0, 100.0 + REPLAN_EVERY_S - 1)
    assert replan_due(100.0, 100.0 + REPLAN_EVERY_S)
