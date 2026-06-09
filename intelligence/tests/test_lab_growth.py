"""Intelligence Lab — digital twin, capability invention, curriculum."""

from __future__ import annotations

import unittest

from intelligence.operations import capability, curriculum, digital_twin


class TestDigitalTwin(unittest.TestCase):
    def test_simulation_never_touches_production(self):
        r = digital_twin.create_worker_simulation({"scenarios": ["pdf_extraction_failure"]})["result"]
        self.assertFalse(r["touches_production"])
        self.assertFalse(r["publishes"])

    def test_publish_simulation_is_isolated(self):
        r = digital_twin.simulate_publish_pipeline({"artifact": {"complete": True, "sensitive": False}})["result"]
        self.assertFalse(r["published_for_real"])
        self.assertEqual(r["simulated_outcome"], "published")

    def test_twin_divergence_detected(self):
        r = digital_twin.compare_simulated_vs_real_outcome({"simulated": "published", "real": "rejected"})["result"]
        self.assertFalse(r["match"])


class TestCapability(unittest.TestCase):
    def test_invention_is_review_gated(self):
        r = capability.invent_capability({"name": "three_path_pdf_extraction"})
        self.assertTrue(r["result"]["review_required"])
        self.assertFalse(r["safe_to_auto_execute"])
        self.assertTrue(r["result"]["required_tests"])

    def test_rank_by_roi(self):
        r = capability.rank_new_capabilities({})["result"]
        self.assertTrue(r["ranked"])
        self.assertEqual(r["top"], r["ranked"][0]["name"])


class TestCurriculum(unittest.TestCase):
    def test_difficulty_ordering(self):
        cases = curriculum.generate_training_cases({"skill": "duplicate_detection"})["result"]["cases"]
        ordered = curriculum.rank_training_difficulty({"cases": cases})["result"]["ordered"]
        diffs = [c["difficulty"] for c in ordered]
        self.assertEqual(diffs, sorted(diffs))

    def test_plateau_detected(self):
        r = curriculum.identify_skill_plateau({"history": {"reasoning": [0.70, 0.71, 0.70, 0.72]}})["result"]
        self.assertIn("reasoning", [p["skill"] for p in r["plateaus"]])

    def test_focus_recommends_weakest(self):
        r = curriculum.recommend_training_focus({"skill_scores": {"a": 0.95, "b": 0.5}})["result"]
        self.assertIn("b", r["focus"])


if __name__ == "__main__":
    unittest.main()
