"""Intelligence Lab — Catholic ontology, strategy tournament, benchmark arena."""

from __future__ import annotations

import unittest

from intelligence.operations import benchmark, catholic_ontology, strategy


class TestOntology(unittest.TestCase):
    def test_valid_relationship(self):
        r = catholic_ontology.validate_entity_relationship(
            {"subject_type": "POPE", "relation": "authored", "object_type": "ENCYCLICAL"}
        )["result"]
        self.assertTrue(r["valid"])

    def test_invalid_relationship(self):
        r = catholic_ontology.validate_entity_relationship(
            {"subject_type": "PARISH", "relation": "authored", "object_type": "ENCYCLICAL"}
        )["result"]
        self.assertFalse(r["valid"])

    def test_apparition_status_constraint(self):
        bad = catholic_ontology.validate_entity_relationship(
            {"subject_type": "APPARITION", "relation": "has_status", "object_type": "SOURCE_AUTHORITY",
             "status": "MAYBE"}
        )["result"]
        self.assertFalse(bad["valid"])

    def test_classify_and_gap(self):
        c = catholic_ontology.classify_entity({"title": "Rerum Novarum encyclical"})["result"]
        self.assertEqual(c["entity_type"], "ENCYCLICAL")
        g = catholic_ontology.detect_ontology_gap({"present_types": ["WIDGET"]})["result"]
        self.assertIn("WIDGET", g["unknown_types"])


class TestStrategy(unittest.TestCase):
    def test_tournament_ranks_safety(self):
        r = strategy.run_strategy_tournament({})["result"]
        self.assertTrue(r["winner"])
        # The catholic_safety_risk cost is heavily weighted; an official-only or
        # catechism strategy (low risk) should beat content_first (higher risk).
        names = [x["name"] for x in r["ranked"]]
        self.assertLess(names.index("catechism_first"), names.index("content_first"))

    def test_explain_winner(self):
        r = strategy.explain_winning_strategy({})["result"]
        self.assertIn("winner", r)
        self.assertTrue(len(r["explanation"]) > 0)


class TestBenchmark(unittest.TestCase):
    def test_weakest_skills(self):
        # A realistic full run: everything strong except PDF diagnosis.
        results = {t: 0.9 for t in benchmark.BENCHMARK_TASKS}
        results["diagnose_pdf_failure"] = 0.3
        r = benchmark.rank_weakest_skills({"results": results})["result"]
        self.assertEqual(r["weakest"][0]["task"], "diagnose_pdf_failure")

    def test_regression_blocks_adoption(self):
        r = benchmark.detect_intelligence_regression(
            {"baseline": {"detect_exact_duplicate": 0.9}, "candidate": {"detect_exact_duplicate": 0.5}}
        )["result"]
        self.assertTrue(r["regression"])

    def test_version_comparison(self):
        r = benchmark.compare_brain_versions({
            "version_a": {"version": "v17", "metrics": {"benchmark_score": 0.7}},
            "version_b": {"version": "v18", "metrics": {"benchmark_score": 0.85}},
        })["result"]
        self.assertEqual(r["better"], "v18")

    def test_upgrade_recommendation_is_review_gated(self):
        r = benchmark.recommend_brain_upgrade({
            "version_a": {"version": "v17", "metrics": {"benchmark_score": 0.7}},
            "version_b": {"version": "v18", "metrics": {"benchmark_score": 0.85}},
        })
        self.assertFalse(r["safe_to_auto_execute"])  # code adoption is always human-reviewed


if __name__ == "__main__":
    unittest.main()
