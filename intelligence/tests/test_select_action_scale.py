"""Regression: the final selector must work on TypeScript's REAL score scale.

TS sends ``finalScore`` values in the tens (urgency + source + repair + quality
- risk), not fractions. The selector used to clamp ``base + adjustments`` to
[0, 1], so every real candidate tied at 1.0 and none of the learned signals
(stage reliability, action fatigue, source reputation) could change the
ranking — confidence was identically 1.0. These pin the normalised behaviour.
"""

from __future__ import annotations

import unittest

from intelligence.operations.planning import select_action


def _ts_scale_candidates():
    # The live case from the audit: DISCOVERY narrowly ahead on raw score but
    # targeting a BLOCKED, fatigued source with a 0% stage success rate;
    # PUBLIC_PUBLISH slightly behind but healthy.
    return [
        {"missionStage": "DISCOVERY", "actionType": "DISCOVER", "finalScore": 62.5, "safe": True,
         "sourceTarget": "weak.example", "contentType": "PRAYER"},
        {"missionStage": "PUBLIC_PUBLISH", "actionType": "PUBLISH", "finalScore": 58.0, "safe": True,
         "contentType": "PRAYER"},
        {"missionStage": "MAINTENANCE", "actionType": "MAINTAIN", "finalScore": 20.0, "safe": True},
    ]


class TsScaleScores(unittest.TestCase):
    def test_baseline_keeps_ts_order_and_reports_scores_on_the_ts_scale(self):
        env = select_action({"candidates": _ts_scale_candidates()})
        result = env["result"]
        self.assertEqual(result["selected_action"], "DISCOVERY")
        # Reported on the caller's scale — comparable with what TS sent — and
        # NOT collapsed to 1.0 for every candidate.
        self.assertAlmostEqual(result["final_score"], 62.5, places=3)
        alts = {a["mission_stage"]: a["final_score"] for a in result["rejected_alternatives"]}
        self.assertAlmostEqual(alts["PUBLIC_PUBLISH"], 58.0, places=3)
        self.assertAlmostEqual(alts["MAINTENANCE"], 20.0, places=3)
        self.assertLess(alts["MAINTENANCE"], alts["PUBLIC_PUBLISH"])

    def test_learned_signals_can_reorder_ts_scale_candidates(self):
        env = select_action(
            {
                "candidates": _ts_scale_candidates(),
                "stageOutcomes": [
                    {"stage": "DISCOVERY", "successRate": 0.0},
                    {"stage": "PUBLIC_PUBLISH", "successRate": 1.0},
                ],
                "sourceReputation": [{"host": "weak.example", "tier": "BLOCKED"}],
                "sourceFatigue": {"weak.example": 9},
                "actionHistory": [{"missionStage": "DISCOVERY"} for _ in range(12)],
            }
        )
        result = env["result"]
        # The unhealthy front-runner LOSES to the healthier alternative.
        self.assertEqual(result["selected_action"], "PUBLIC_PUBLISH")
        self.assertTrue(any(s.startswith("action_fatigue:DISCOVERY") for s in result["memories_used"]))
        self.assertIn("weak.example:BLOCKED", result["source_reputation_used"])

    def test_confidence_is_not_identically_one(self):
        env = select_action(
            {
                "candidates": _ts_scale_candidates(),
                "stageOutcomes": [{"stage": "DISCOVERY", "successRate": 0.2}],
                "actionHistory": [{"missionStage": "DISCOVERY"} for _ in range(6)],
            }
        )
        self.assertGreater(env["confidence"], 0.0)
        self.assertLess(env["confidence"], 1.0)

    def test_unit_scale_inputs_are_unchanged(self):
        # Existing callers / self-tests send 0-1 scores; those must behave
        # exactly as before (no scaling applied).
        env = select_action(
            {
                "candidates": [
                    {"missionStage": "DISCOVERY", "finalScore": 0.7, "safe": True},
                    {"missionStage": "REPORTING", "finalScore": 0.4, "safe": True},
                ]
            }
        )
        self.assertEqual(env["result"]["selected_action"], "DISCOVERY")
        self.assertAlmostEqual(env["result"]["final_score"], 0.7, places=3)
        self.assertAlmostEqual(env["confidence"], 0.7, places=3)


if __name__ == "__main__":
    unittest.main()
