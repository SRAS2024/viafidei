"""Proves the Python brain is the FINAL action selector: it ranks the
candidate action set, selects a final action with the strict decision
contract, and learning (exact stage outcomes + action fatigue) changes the
ranking on the next pass."""

from __future__ import annotations

import unittest

from intelligence.operations.planning import select_action

REQUIRED_CONTRACT_KEYS = [
    "selected_action",
    "mission_stage",
    "target_content_type",
    "target_source",
    "target_candidate_url",
    "target_package_artifact",
    "expected_result",
    "final_score",
    "confidence_score",
    "risk_score",
    "urgency_score",
    "source_score",
    "quality_expectation",
    "repair_likelihood",
    "fallback_action",
    "stop_condition",
    "rejected_alternatives",
    "reasoning",
    "evidence_used",
    "memories_used",
    "source_reputation_used",
    "stage_outcomes_used",
    "safety_notes",
]


def _candidates():
    return [
        {"missionStage": "DISCOVERY", "actionType": "DISCOVER", "finalScore": 0.70, "safe": True,
         "sourceTarget": "vatican.va", "contentType": "PRAYER"},
        {"missionStage": "REPORTING", "actionType": "REPORT", "finalScore": 0.55, "safe": True},
    ]


class SelectActionContract(unittest.TestCase):
    def test_returns_full_strict_contract(self):
        env = select_action({"candidates": _candidates()})
        self.assertTrue(env["ok"])
        result = env["result"]
        for key in REQUIRED_CONTRACT_KEYS:
            self.assertIn(key, result, f"missing contract key: {key}")
        # Selected = the highest-scoring safe candidate; the other is rejected
        # with a reason.
        self.assertEqual(result["selected_action"], "DISCOVERY")
        self.assertTrue(len(result["rejected_alternatives"]) >= 1)
        self.assertIsNotNone(result["rejected_alternatives"][0]["rejected_reason"])

    def test_ranks_every_candidate(self):
        env = select_action({"candidates": _candidates()})
        # both candidates appear in evidence/rejected so all were ranked
        stages = {result_alt["mission_stage"] for result_alt in env["result"]["rejected_alternatives"]}
        stages.add(env["result"]["mission_stage"])
        self.assertIn("DISCOVERY", stages)
        self.assertIn("REPORTING", stages)


class LearningChangesRanking(unittest.TestCase):
    def test_low_stage_success_rate_deprioritises_the_top_action(self):
        # Baseline: DISCOVERY wins on its higher base score.
        base = select_action({"candidates": _candidates()})
        self.assertEqual(base["result"]["selected_action"], "DISCOVERY")

        # Learning: exact stage outcomes show DISCOVERY failing badly +
        # repeated recent DISCOVERY selections (action fatigue). The brain
        # must now switch to REPORTING — learning changed the ranking.
        learned = select_action(
            {
                "candidates": _candidates(),
                "stageOutcomes": [
                    {"stage": "DISCOVERY", "successRate": 0.0},
                    {"stage": "REPORTING", "successRate": 1.0},
                ],
                "actionHistory": [
                    {"missionStage": "DISCOVERY"},
                    {"missionStage": "DISCOVERY"},
                    {"missionStage": "DISCOVERY"},
                ],
            }
        )
        self.assertEqual(learned["result"]["selected_action"], "REPORTING")
        # The reasoning cites the exact stage outcomes it used.
        self.assertTrue(any("DISCOVERY" in s for s in learned["result"]["stage_outcomes_used"]))

    def test_blocked_source_reputation_lowers_a_candidate(self):
        learned = select_action(
            {
                "candidates": _candidates(),
                "sourceReputation": [{"host": "vatican.va", "tier": "BLOCKED"}],
            }
        )
        # vatican.va is BLOCKED → DISCOVERY (which targets it) drops below
        # REPORTING.
        self.assertEqual(learned["result"]["selected_action"], "REPORTING")



class SourceRecovery(unittest.TestCase):
    def test_watch_source_is_not_excluded_and_gets_a_recovery_nudge(self):
        # A WATCH (deprioritised) source is penalised but NOT excluded, and
        # gets a small recovery nudge so it is periodically retested.
        env = select_action(
            {
                "candidates": [
                    {"missionStage": "DISCOVERY", "actionType": "DISCOVER", "finalScore": 0.70,
                     "safe": True, "sourceTarget": "watch.example", "contentType": "PRAYER"},
                ],
                "sourceReputation": [{"host": "watch.example", "tier": "WATCH"}],
            }
        )
        # Still selectable (recovery), and the recovery is recorded.
        self.assertEqual(env["result"]["selected_action"], "DISCOVERY")
        self.assertTrue(any("source_recovery" in m for m in env["result"]["memories_used"]))



if __name__ == "__main__":
    unittest.main()
