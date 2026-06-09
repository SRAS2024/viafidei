"""Intelligence Lab — counterfactual, experiment, and hypothesis reasoning."""

from __future__ import annotations

import unittest

from intelligence.operations import counterfactual, experiments, hypotheses


class TestCounterfactual(unittest.TestCase):
    def test_idle_decision_has_better_alternative(self):
        r = counterfactual.run_counterfactual_analysis({"actual": {"outcome": "idle"}})["result"]
        self.assertGreater(r["regret"], 0)
        self.assertIn(r["best_alternative"], counterfactual._ALTERNATIVES)

    def test_rank_paths_penalises_risk(self):
        r = counterfactual.rank_counterfactual_paths({"actual": {"outcome": "failed"}})["result"]
        self.assertEqual(r["ranked"][0]["alternative"], r["winner"])

    def test_explain_difference(self):
        r = counterfactual.explain_counterfactual_difference(
            {"alternative": "different_source", "actual": {"outcome": "failed"}}
        )["result"]
        self.assertIn(r["direction"], ("better", "worse", "similar"))


class TestExperiments(unittest.TestCase):
    def test_design_is_bounded(self):
        r = experiments.design_safe_experiment(
            {"question": "q", "groups": ["a", "b"], "sample_per_group": 99}
        )["result"]
        self.assertLessEqual(r["sample_per_group"], 10)
        self.assertFalse(r["publishes"])

    def test_unsafe_plan_rejected(self):
        r = experiments.run_experiment_plan(
            {"plan": {"groups": ["a", "b"], "sample_per_group": 999, "publishes": True}}
        )["result"]
        self.assertFalse(r["runnable"])

    def test_conclusive_comparison(self):
        r = experiments.compare_experiment_groups(
            {"groups": [{"name": "a", "successes": 5, "n": 5}, {"name": "b", "successes": 1, "n": 5}]}
        )["result"]
        self.assertTrue(r["conclusive"])
        self.assertEqual(r["leader"], "a")


class TestHypotheses(unittest.TestCase):
    def test_generate_from_signal(self):
        r = hypotheses.generate_hypothesis({"signals": {"church_document_gap": 1}})["result"]
        keys = [h["key"] for h in r["hypotheses"]]
        self.assertIn("church_document_stuck", keys)
        for h in r["hypotheses"]:
            self.assertIn("experiment_plan", h)
            self.assertIn("success_criteria", h)

    def test_evaluate_and_accept(self):
        ev = hypotheses.evaluate_hypothesis_result(
            {"hypothesis": {"key": "x"}, "observed": {"met_criteria": True}}
        )["result"]
        self.assertEqual(ev["verdict"], "SUPPORTED")
        dec = hypotheses.accept_or_reject_hypothesis({"verdict": "SUPPORTED", "confidence": 0.8})["result"]
        self.assertEqual(dec["decision"], "ACCEPTED")


if __name__ == "__main__":
    unittest.main()
