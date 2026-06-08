"""
Tests for the unified-brain reasoning modules: Catholic authority graph,
claim-level verification, action simulation, and confidence calibration.
"""

import unittest

from intelligence.operations import authority, calibration, claims, simulation

ENVELOPE_KEYS = {
    "ok", "result", "confidence", "reasoning", "evidence",
    "sources_used", "risk_level", "recommended_next_action",
    "safe_to_auto_execute", "error",
}


def ok(r):
    assert ENVELOPE_KEYS.issubset(r), r
    assert r["ok"], r
    assert 0.0 <= r["confidence"] <= 1.0
    return r["result"]


class TestAuthority(unittest.TestCase):
    def test_rank_flags_blog_for_review_and_vatican_autopublish(self):
        res = ok(
            authority.rank_catholic_source_authority(
                {
                    "sources": [
                        {"id": "a", "name": "Holy See", "url": "https://www.vatican.va", "authorityLevel": "VATICAN"},
                        {"id": "b", "name": "blog", "url": "https://blog.example.com", "contradictions": 3},
                    ]
                }
            )
        )
        ranked = {r["id"]: r for r in res["ranked"]}
        self.assertTrue(ranked["a"]["may_auto_publish"])
        self.assertFalse(ranked["b"]["may_auto_publish"])
        self.assertEqual(ranked["a"]["authority_level"], "VATICAN")

    def test_resolve_authority_chain_winner(self):
        res = ok(authority.resolve_authority_chain({"levels": ["DIOCESAN", "VATICAN", "COMMUNITY"]}))
        self.assertEqual(res["winner"], "VATICAN")
        self.assertEqual(res["ordered"][0], "VATICAN")

    def test_classify_document_authority(self):
        res = ok(authority.classify_document_authority({"document_type": "encyclical"}))
        self.assertEqual(res["authority_level"], "VATICAN")


class TestClaims(unittest.TestCase):
    def test_extract_claims_finds_apparition_year(self):
        res = ok(
            claims.extract_claims(
                {"text": "The apparition occurred in 1858 at Lourdes.", "subject": "Lourdes"}
            )
        )
        preds = {c["predicate"]: c["value"] for c in res["claims"]}
        self.assertEqual(preds.get("apparition_year"), "1858")

    def test_compare_claims_blocks_lower_authority(self):
        res = ok(
            claims.compare_claims(
                {
                    "claims": [
                        {"subject": "Lourdes", "predicate": "apparition_year", "value": "1858", "authority_level": "VATICAN", "source": "a"},
                        {"subject": "Lourdes", "predicate": "apparition_year", "value": "1854", "authority_level": "COMMUNITY", "source": "b"},
                    ]
                }
            )
        )
        self.assertEqual(res["conflict_count"], 1)
        r0 = res["resolutions"][0]
        self.assertFalse(r0["agreement"])
        self.assertEqual(r0["preferred_value"], "1858")  # VATICAN wins
        self.assertEqual(r0["decision"], "block-lower-authority-pending-review")

    def test_tie_requires_human_review(self):
        res = ok(
            claims.compare_claims(
                {
                    "claims": [
                        {"subject": "X", "predicate": "feast_day", "value": "May 13", "authority_level": "COMMUNITY"},
                        {"subject": "X", "predicate": "feast_day", "value": "May 14", "authority_level": "COMMUNITY"},
                    ]
                }
            )
        )
        self.assertEqual(res["review_count"], 1)

    def test_resolve_claim_with_authority_prefers_vatican(self):
        res = ok(
            claims.resolve_claim_with_authority(
                {
                    "claims": [
                        {"subject": "Lourdes", "predicate": "apparition_year", "value": "1858", "authority_level": "VATICAN", "source": "a"},
                        {"subject": "Lourdes", "predicate": "apparition_year", "value": "1854", "authority_level": "COMMUNITY", "source": "b"},
                    ]
                }
            )
        )
        self.assertEqual(res["resolution"]["preferred_value"], "1858")


class TestSimulation(unittest.TestCase):
    def test_compare_counterfactuals_ranks_best_first(self):
        res = ok(
            simulation.compare_counterfactual_actions(
                {
                    "actions": [
                        {"missionStage": "PUBLIC_PUBLISH", "actionType": "PUBLISH", "finalScore": 0.85, "safe": True, "contentType": "PRAYER"},
                        {"missionStage": "DISCOVERY", "actionType": "DISCOVER", "finalScore": 0.3, "safe": True},
                    ],
                    "stage_outcomes": [
                        {"stage": "PUBLIC_PUBLISH", "successRate": 0.9},
                        {"stage": "DISCOVERY", "successRate": 0.5},
                    ],
                }
            )
        )
        self.assertEqual(res["best"]["action"], "PUBLISH")
        self.assertTrue(res["explanation"])

    def test_simulate_action_estimates(self):
        res = ok(
            simulation.simulate_action(
                {"action": {"missionStage": "SOURCE_FETCH", "finalScore": 0.7, "safe": True, "sourceTarget": "weak.x", "contentType": "APPARITION"}, "source_fatigue": {"weak.x": 4}}
            )
        )
        sim = res["simulation"]
        self.assertIn("expected_value", sim)
        self.assertGreater(sim["source_risk"], 0.4)  # weak source


class TestCalibration(unittest.TestCase):
    def test_calibrate_lowers_overconfident_op(self):
        res = ok(
            calibration.calibrate_confidence(
                {
                    "records": [
                        {"op": "x", "predicted": True, "actual": False, "confidence": 0.95},
                        {"op": "x", "predicted": True, "actual": False, "confidence": 0.9},
                        {"op": "x", "predicted": True, "actual": False, "confidence": 0.9},
                    ]
                }
            )
        )
        adj = res["adjustments"][0]
        self.assertEqual(adj["op"], "x")
        self.assertEqual(adj["direction"], "lower")
        self.assertLess(adj["confidence_multiplier"], 1.0)

    def test_grade_confident_wrong_is_low(self):
        res = ok(calibration.grade_brain_decision({"decision": {"predicted": "success", "actual": "failure", "confidence": 0.95}}))
        self.assertFalse(res["correct"])
        self.assertLess(res["quality"], 0.5)


if __name__ == "__main__":
    unittest.main()
