"""
Tests for the replayability & resilience operations: decision replay,
comparison, change explanation, drift detection, per-scope circuit breakers, and
stored-output integrity checks. All return the strict envelope.
"""

import unittest

from intelligence.operations import replay

ENVELOPE_KEYS = {
    "ok",
    "result",
    "confidence",
    "reasoning",
    "evidence",
    "sources_used",
    "risk_level",
    "recommended_next_action",
    "safe_to_auto_execute",
    "error",
}


def ok(r):
    assert ENVELOPE_KEYS.issubset(r), r
    assert r["ok"], r
    return r["result"]


class TestReplay(unittest.TestCase):
    def test_replay_reproduces_decision(self):
        res = ok(
            replay.replay_decision(
                {
                    "chosen_stage": "DISCOVERY",
                    "candidates": [
                        {"missionStage": "DISCOVERY", "finalScore": 0.7, "safe": True},
                        {"missionStage": "REPORTING", "finalScore": 0.4, "safe": True},
                    ],
                }
            )
        )
        self.assertTrue(res["reproduced"])

    def test_replay_detects_divergence(self):
        res = ok(
            replay.replay_decision(
                {
                    "chosen_stage": "REPORTING",  # not the top-scored candidate
                    "candidates": [
                        {"missionStage": "DISCOVERY", "finalScore": 0.9, "safe": True},
                        {"missionStage": "REPORTING", "finalScore": 0.4, "safe": True},
                    ],
                }
            )
        )
        self.assertFalse(res["reproduced"])
        self.assertEqual(res["replayed_stage"], "DISCOVERY")

    def test_compare_decisions_flags_change(self):
        res = ok(
            replay.compare_decisions(
                {
                    "a": {"missionStage": "DISCOVERY", "chosenAction": "DISCOVER", "finalScore": 0.6},
                    "b": {"missionStage": "SOURCE_FETCH", "chosenAction": "FETCH", "finalScore": 0.8},
                }
            )
        )
        self.assertTrue(res["changed"])
        self.assertFalse(res["same_stage"])
        self.assertAlmostEqual(res["score_delta"], 0.2, places=3)

    def test_explain_decision_change(self):
        res = ok(
            replay.explain_decision_change(
                {
                    "previous": {"missionStage": "DISCOVERY", "finalScore": 0.5},
                    "current": {"missionStage": "SOURCE_FETCH", "finalScore": 0.8},
                    "world_changes": ["new trusted source available"],
                }
            )
        )
        self.assertTrue(any("DISCOVERY" in line for line in res["explanation"]))

    def test_detect_decision_drift_oscillation(self):
        res = ok(
            replay.detect_decision_drift(
                {
                    "decisions": [
                        {"missionStage": "DISCOVERY"},
                        {"missionStage": "REPORTING"},
                        {"missionStage": "DISCOVERY"},
                        {"missionStage": "REPORTING"},
                    ]
                }
            )
        )
        self.assertTrue(res["drift"])
        self.assertTrue(res["oscillating"])

    def test_detect_decision_drift_healthy(self):
        res = ok(
            replay.detect_decision_drift(
                {
                    "decisions": [
                        {"missionStage": "DISCOVERY"},
                        {"missionStage": "SOURCE_FETCH"},
                        {"missionStage": "EXTRACTION"},
                        {"missionStage": "PUBLIC_PUBLISH"},
                    ]
                }
            )
        )
        self.assertFalse(res["drift"])

    def test_recommend_circuit_break_opens_on_high_failure(self):
        r = replay.recommend_circuit_break(
            {"scope": "host", "key": "weak.example", "attempts": 5, "failures": 4, "consecutive_failures": 3}
        )
        res = r["result"]
        self.assertEqual(res["state"], "open")
        self.assertFalse(r["safe_to_auto_execute"])
        self.assertGreater(res["cooldown_passes"], 0)

    def test_recommend_circuit_break_closed_when_healthy(self):
        res = ok(
            replay.recommend_circuit_break(
                {"scope": "stage", "key": "EXTRACTION", "attempts": 10, "failures": 1}
            )
        )
        self.assertEqual(res["state"], "closed")

    def test_check_replay_integrity_flags_corrupt(self):
        r = replay.check_replay_integrity(
            {
                "records": [
                    {
                        "ok": True,
                        "result": {},
                        "confidence": 0.8,
                        "reasoning": "x",
                        "evidence": [],
                        "sources_used": [],
                        "risk_level": "low",
                        "recommended_next_action": "",
                        "safe_to_auto_execute": False,
                        "error": None,
                    },
                    {"ok": True, "confidence": 5.0},  # missing keys + bad confidence
                ]
            }
        )
        res = r["result"]
        self.assertEqual(res["healthy"], 1)
        self.assertEqual(res["corrupt_count"], 1)
        self.assertFalse(r["safe_to_auto_execute"])


if __name__ == "__main__":
    unittest.main()
