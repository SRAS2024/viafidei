"""
Tests for stuckness/loop detection, mission control, self-explanation,
the upgrade-request engine, and test-gap detection.
"""

import unittest

from intelligence.operations import explanation, mission, stuckness, testgaps, upgrades

ENVELOPE_KEYS = {
    "ok", "result", "confidence", "reasoning", "evidence",
    "sources_used", "risk_level", "recommended_next_action",
    "safe_to_auto_execute", "error",
}


def ok(r):
    assert ENVELOPE_KEYS.issubset(r), r
    assert r["ok"], r
    return r["result"]


class TestStuckness(unittest.TestCase):
    def test_action_loop(self):
        res = ok(stuckness.detect_action_loop({"recent_decisions": [{"missionStage": "DISCOVERY"}] * 6}))
        self.assertTrue(res["loop"])
        self.assertEqual(res["stage"], "DISCOVERY")

    def test_source_loop(self):
        res = ok(stuckness.detect_source_loop({"source_fatigue": {"bad.x": 5, "ok.y": 1}}))
        self.assertIn("bad.x", res["deprioritize"])
        self.assertNotIn("ok.y", res["deprioritize"])

    def test_repair_loop(self):
        res = ok(stuckness.detect_repair_loop({"recent_repairs": [{"kind": "FETCH_FAILED", "status": "FAILED"}] * 3}))
        self.assertTrue(res["loop"])

    def test_no_growth_and_explain(self):
        res = ok(stuckness.detect_no_growth({"pass_count": 6, "published_delta": 0}))
        self.assertTrue(res["no_growth"])
        exp = ok(stuckness.explain_no_growth({"candidate_count": 0}))
        self.assertTrue(exp["reasons"])

    def test_recommend_unblock(self):
        res = ok(stuckness.recommend_unblock_strategy({"signals": ["source loop", "no content growth"]}))
        self.assertTrue(res["strategies"])


class TestMission(unittest.TestCase):
    def test_build_mission_tree_completion(self):
        res = ok(
            mission.build_mission_tree(
                {
                    "goals": [
                        {"contentType": "SACRAMENT", "currentValidCount": 7, "desiredTarget": 7, "canonicalMax": 7},
                        {"contentType": "PRAYER", "currentValidCount": 28, "desiredTarget": 1000},
                    ]
                }
            )
        )
        by = {m["content_type"]: m for m in res["missions"]}
        self.assertEqual(by["SACRAMENT"]["status"], "complete")
        self.assertEqual(by["PRAYER"]["status"], "in_progress")
        # least-complete sorts first
        self.assertEqual(res["missions"][0]["content_type"], "PRAYER")

    def test_detect_mission_blockers(self):
        res = ok(
            mission.detect_mission_blockers(
                {"mission": {"content_type": "PARISH", "source_coverage": False}}
            )
        )
        self.assertTrue(res["blocked"])

    def test_rank_subgoals(self):
        res = ok(
            mission.rank_subgoals(
                {"missions": [{"content_type": "A", "completion_pct": 0.9, "priority": 0.5}, {"content_type": "B", "completion_pct": 0.1, "priority": 0.9}]}
            )
        )
        self.assertEqual(res["next_subgoal"]["content_type"], "B")


class TestExplanation(unittest.TestCase):
    def test_explain_decision(self):
        res = ok(
            explanation.explain_decision(
                {"decision": {"selectedAction": "FETCH", "missionStage": "SOURCE_FETCH", "reasoning": "best EV", "confidenceScore": 0.8}}
            )
        )
        self.assertTrue(any("FETCH" in line for line in res["explanation"]))

    def test_explain_safety_gate_blocks_sensitive(self):
        res = ok(explanation.explain_safety_gate({"risk_level": "low", "confidence": 0.9, "sensitive": True}))
        self.assertFalse(res["safe"])

    def test_what_would_change_my_mind(self):
        res = ok(explanation.explain_what_would_change_my_mind({"decision": "publish"}))
        self.assertTrue(res["would_change_my_mind"])


class TestUpgrades(unittest.TestCase):
    def test_rank_upgrade_requests(self):
        res = ok(
            upgrades.rank_upgrade_requests(
                {
                    "requests": [
                        {"title": "low", "severity": "low", "occurrences": 1, "difficulty": "high"},
                        {"title": "high", "severity": "high", "occurrences": 8, "difficulty": "low"},
                    ]
                }
            )
        )
        self.assertEqual(res["top"]["title"], "high")

    def test_merge_duplicates(self):
        res = ok(
            upgrades.merge_duplicate_upgrade_requests(
                {
                    "threshold": 0.5,
                    "requests": [
                        {"title": "Add PDF parser", "detail": "pdf extraction fails", "occurrences": 3},
                        {"title": "PDF parser needed", "detail": "pdf extraction fails repeatedly", "occurrences": 2},
                    ],
                }
            )
        )
        self.assertEqual(res["merged_count"], 1)
        self.assertEqual(res["merged"][0]["occurrences"], 5)


class TestTestGaps(unittest.TestCase):
    def test_detect_test_gap_maps_pdf_failure(self):
        res = ok(
            testgaps.detect_test_gap(
                {"failures": [{"category": "extraction", "error": "pdf extraction failed"}] * 3}
            )
        )
        kinds = {g["failure_kind"] for g in res["test_gaps"]}
        self.assertIn("pdf", kinds)

    def test_suggest_regression_test(self):
        res = ok(testgaps.suggest_regression_test({"failure": "duplicate missed by slug matching"}))
        self.assertEqual(res["failure_kind"], "duplicate")
        self.assertFalse(False)  # sanity

    def test_propose_test_patch_is_review_gated(self):
        r = testgaps.propose_test_patch({"failure": "schema mismatch"})
        self.assertFalse(r["safe_to_auto_execute"])
        self.assertTrue(r["result"]["proposal"]["requires_human_review"])


if __name__ == "__main__":
    unittest.main()
