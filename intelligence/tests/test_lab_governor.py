"""Intelligence Lab — adversarial self-testing, architecture governor, leverage."""

from __future__ import annotations

import unittest

from intelligence.operations import adversarial, architecture, leverage


class TestAdversarial(unittest.TestCase):
    def test_uncovered_gate_is_a_weakness(self):
        r = adversarial.attack_decision(
            {"case": "duplicate_different_title", "active_defenses": []}
        )["result"]
        self.assertFalse(r["held"])

    def test_covered_gate_holds(self):
        r = adversarial.attack_decision(
            {"case": "duplicate_different_title", "active_defenses": ["duplicate"]}
        )["result"]
        self.assertTrue(r["held"])

    def test_regression_request_is_review_gated(self):
        r = adversarial.create_regression_from_attack({"case": "saint_one_wrong_date"})
        self.assertFalse(r["safe_to_auto_execute"])
        self.assertIn("regression_request", r["result"])


class TestArchitectureGovernor(unittest.TestCase):
    def test_clean_architecture(self):
        r = architecture.check_architecture_integrity({"report": {}})["result"]
        self.assertTrue(r["clean"])
        self.assertEqual(r["integrity"], 1.0)

    def test_competing_path_detected(self):
        r = architecture.detect_competing_paths(
            {"report": {"competingPaths": ["legacy-final-brain"]}}
        )["result"]
        self.assertTrue(r["found"])

    def test_unified_boundary_breach(self):
        r = architecture.enforce_unified_brain_boundary(
            {"report": {"legacyFallbacks": ["ts-final-brain"]}}
        )["result"]
        self.assertFalse(r["unified"])


class TestLeverage(unittest.TestCase):
    def test_ranks_by_value_over_cost(self):
        r = leverage.rank_highest_leverage_change({})["result"]
        self.assertTrue(r["highest_leverage"])
        levs = [d["leverage"] for d in r["ranked"]]
        self.assertEqual(levs, sorted(levs, reverse=True))

    def test_explanation_is_review_gated(self):
        r = leverage.explain_highest_leverage_change({})
        self.assertFalse(r["safe_to_auto_execute"])  # touches code/schema → human review
        self.assertTrue(r["result"]["review_required"])


if __name__ == "__main__":
    unittest.main()
