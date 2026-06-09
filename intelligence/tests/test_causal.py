"""Causal Intelligence Core — proves the brain finds root causes and chains."""

from __future__ import annotations

import unittest

from intelligence.operations import causal


class TestCausalCore(unittest.TestCase):
    def test_build_causal_graph(self):
        r = causal.build_causal_graph({"signals": {"missing_fields": 12}})
        res = r["result"]
        self.assertTrue(res["edge_count"] >= 10)
        self.assertIn("missing_fields", res["factors"])

    def test_infer_causal_factors(self):
        r = causal.infer_causal_factors({"effect": "strict_qa_failure"})
        factors = [f["factor"] for f in r["result"]["factors"]]
        self.assertIn("missing_fields", factors)

    def test_explain_root_cause_traces_to_source_type(self):
        # mission_stagnation <- publish_delay <- strict_qa_failure <- missing_fields
        # <- extraction_difficulty <- source_type
        r = causal.explain_root_cause({"symptom": "mission_stagnation"})
        res = r["result"]
        self.assertEqual(res["root_cause"], "source_type")
        self.assertTrue(res["depth"] >= 4)
        self.assertTrue(len(res["intervention"]) > 0)

    def test_detect_causal_chain_downstream(self):
        r = causal.detect_causal_chain({"factor": "missing_parser"})
        self.assertEqual(r["result"]["terminal_effect"], "repair_failure")

    def test_rank_causal_factors_prefers_high_leverage(self):
        r = causal.rank_causal_factors({"signals": {}})
        ranked = r["result"]["ranked"]
        self.assertTrue(len(ranked) > 0)
        # source_type sits at the head of the longest chain → high leverage.
        self.assertIn("source_type", [d["factor"] for d in ranked[:3]])

    def test_update_causal_model_moves_strength(self):
        up = causal.update_causal_model(
            {"cause": "missing_fields", "effect": "strict_qa_failure", "confirmed": True}
        )["result"]
        self.assertGreater(up["updated_strength"], up["prior_strength"])
        down = causal.update_causal_model(
            {"cause": "missing_fields", "effect": "strict_qa_failure", "confirmed": False}
        )["result"]
        self.assertLess(down["updated_strength"], down["prior_strength"])

    def test_explain_causal_model_edge_and_overview(self):
        edge = causal.explain_causal_model(
            {"cause": "missing_fields", "effect": "strict_qa_failure"}
        )
        self.assertIn("missing_fields", edge["result"]["explanation"])
        overview = causal.explain_causal_model({})
        self.assertIn("source_type", overview["result"]["root_factors"])

    def test_unknown_edge_raises(self):
        from intelligence.contracts import BrainError

        with self.assertRaises(BrainError):
            causal.explain_causal_model({"cause": "nope", "effect": "nada"})


if __name__ == "__main__":
    unittest.main()
