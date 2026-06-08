"""
Unified-intelligence PROOF test (spec final section: "add or update any proof
tests needed to show that …"). Each test maps to one of the spec's numbered
proof points and asserts it directly against the brain operations, so the suite
is a single, auditable demonstration that the unified brain does what the spec
requires. Points 1-2 (Python is the final decision brain; no competing path) are
proven on the TypeScript side in
tests/admin-worker/proof/unified-intelligence.proof.test.ts.

Deterministic, stdlib, no DB — runs under `npm run brain:proof` and `brain:test`.
"""

from __future__ import annotations

import unittest

from intelligence.main import handle_request
from intelligence.operations import (
    authority,
    calibration,
    claims,
    patches,
    self_model,
    simulation,
    testgaps,
)
from intelligence.registry import list_ops

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

CORPUS = {
    "files": [
        {"path": "src/lib/admin-worker/dispatcher.ts", "lines": 2200,
         "exports": ["executeMissionStage", "a", "b", "c", "d", "e"],
         "imports": ["src/lib/admin-worker/logs.ts"], "referencedByTests": True},
        {"path": "src/lib/admin-worker/logs.ts", "lines": 90, "exports": ["writeAdminWorkerLog"],
         "imports": [], "referencedByTests": True},
        {"path": "src/lib/admin-worker/orphan.ts", "lines": 300, "exports": ["unusedThing"],
         "imports": [], "referencedByTests": False},
        {"path": "src/lib/admin-worker/dispatcher.test.ts", "lines": 60, "exports": [],
         "imports": ["src/lib/admin-worker/dispatcher.ts"], "isTest": True},
    ],
    "routes": [{"path": "/prayers", "file": "prayers/page.tsx"}],
    "models": [{"name": "Prayer", "usedByFiles": 4}],
    "scripts": ["dev", "test"],
    "stages": ["DISCOVERY", "PUBLIC_PUBLISH"],
    "brain_ops": ["select_action", "build_self_model"],
}


def ok(resp):
    assert ENVELOPE_KEYS.issubset(resp), f"not an envelope: {resp}"
    assert resp["ok"], f"op not ok: {resp.get('error')}"
    assert 0.0 <= resp["confidence"] <= 1.0
    return resp["result"]


class TestUnifiedIntelligenceProof(unittest.TestCase):
    # Proof 3: the SelfModel is created (persistence is proven in the TS
    # integration suite, which writes AdminWorkerSelfModelSnapshot).
    def test_03_self_model_is_created(self):
        res = ok(self_model.build_self_model(CORPUS))
        self.assertGreater(res["file_count"], 0)
        self.assertGreater(res["brain_op_count"], 0)
        self.assertIn("test_coverage_ratio", res)

    # Proof 4: the brain can explain its own architecture.
    def test_04_explains_own_architecture(self):
        model = ok(self_model.build_self_model(CORPUS))
        res = ok(self_model.explain_own_architecture({"model": model}))
        layers = " ".join(res["layers"]).lower()
        self.assertIn("python", layers)
        self.assertIn("typescript", layers)
        self.assertIn("postgres", layers)

    # Proof 5: the brain can identify its own weaknesses.
    def test_05_identifies_weaknesses(self):
        res = ok(self_model.find_weak_modules(CORPUS))
        self.assertGreaterEqual(res["weak_count"], 1)
        self.assertTrue(any("dispatcher" in w["path"] for w in res["weak_modules"]))
        # Deep code awareness: a weak module explains why + a split plan.
        first = res["weak_modules"][0]
        self.assertIn("why", first)
        self.assertIn("suggested_split", first)

    # Proof 6: the brain can rank its own upgrade requests (full 20-field record).
    def test_06_ranks_upgrade_requests(self):
        weak = ok(self_model.find_weak_modules(CORPUS))["weak_modules"]
        untested = ok(self_model.find_untested_modules(CORPUS))["untested_modules"]
        res = ok(self_model.rank_self_upgrades(
            {"weak_modules": weak, "untested_modules": untested, "coverage_ratio": 0.5}
        ))
        self.assertGreaterEqual(res["upgrade_count"], 1)
        u = res["upgrades"][0]
        for key in (
            "title", "category", "problem", "evidence", "affected_files", "affected_models",
            "affected_worker_stages", "affected_brain_operations", "affected_public_routes",
            "affected_admin_routes", "expected_intelligence_gain", "expected_user_value",
            "risk_if_not_fixed", "implementation_difficulty", "suggested_implementation_plan",
            "suggested_tests", "suggested_migration", "rollback_plan", "priority_score",
            "confidence_score",
        ):
            self.assertIn(key, u, f"upgrade missing field {key}")

    # Proof 7: the brain can detect stuckness.
    def test_07_detects_stuckness(self):
        res = ok(self_model.detect_stuckness({
            "recent_decisions": [{"missionStage": "DISCOVERY"}] * 8,
            "recent_repairs": [{"kind": "FETCH_FAILED", "status": "FAILED"}] * 4,
            "published_delta": 0,
            "pass_count": 8,
            "source_fatigue": {"weak.example": 5},
        }))
        self.assertTrue(res["stuck"])
        self.assertGreaterEqual(len(res["signals"]), 2)

    # Proof 8: the brain can simulate actions (and compare counterfactuals).
    def test_08_simulates_actions(self):
        res = ok(simulation.simulate_action({
            "action": {"missionStage": "SOURCE_FETCH", "actionType": "FETCH", "finalScore": 0.7, "safe": True},
            "stage_outcomes": [{"stage": "SOURCE_FETCH", "successRate": 0.8}],
        }))
        sim = res["simulation"]
        for key in ("expected_value", "failure_probability", "publish_risk", "safety_risk",
                    "source_risk", "repair_cost", "time_cost", "likely_next_stage",
                    "moves_mission_forward"):
            self.assertIn(key, sim)
        cf = ok(simulation.compare_counterfactual_actions({
            "actions": [
                {"missionStage": "PUBLIC_PUBLISH", "actionType": "PUBLISH", "finalScore": 0.8, "safe": True, "contentType": "PRAYER"},
                {"missionStage": "DISCOVERY", "actionType": "DISCOVER", "finalScore": 0.4, "safe": True},
            ],
            "stage_outcomes": [{"stage": "PUBLIC_PUBLISH", "successRate": 0.85}],
        }))
        self.assertIn("best", cf)
        self.assertTrue(cf["explanation"])

    # Proof 9: the brain can calibrate confidence.
    def test_09_calibrates_confidence(self):
        res = ok(calibration.calibrate_confidence({
            "records": [
                {"op": "detect_duplicates", "predicted": True, "actual": True, "confidence": 0.6},
                {"op": "detect_duplicates", "predicted": True, "actual": True, "confidence": 0.6},
                {"op": "detect_duplicates", "predicted": False, "actual": True, "confidence": 0.9},
            ]
        }))
        self.assertIn("adjustments", res)

    # Proof 10: the brain can detect missing tests.
    def test_10_detects_missing_tests(self):
        res = ok(testgaps.detect_test_gap({
            "failures": [{"category": "extraction", "error": "pdf extraction failed"}] * 3
            + [{"category": "publish", "error": "publish verification failed"}] * 2,
        }))
        self.assertGreaterEqual(res["gap_count"], 1)
        kinds = {g["failure_kind"] for g in res["test_gaps"]}
        self.assertTrue(kinds)

    # Proof 11: the brain can reason through Catholic authority.
    def test_11_reasons_through_catholic_authority(self):
        ranked = ok(authority.rank_catholic_source_authority({
            "sources": [
                {"id": "v", "name": "The Holy See", "url": "https://www.vatican.va", "authorityLevel": "VATICAN"},
                {"id": "b", "name": "Some Blog", "url": "https://blog.example.com", "authorityLevel": "COMMUNITY"},
            ]
        }))
        self.assertEqual(ranked["ranked"][0]["id"], "v")  # Vatican outranks a blog
        chain = ok(authority.resolve_authority_chain({"levels": ["COMMUNITY", "VATICAN", "DIOCESAN"]}))
        self.assertEqual(chain["winner"], "VATICAN")

    # Proof 12: the brain can detect claim conflicts (and resolve by authority).
    def test_12_detects_claim_conflicts(self):
        res = ok(claims.resolve_claim_with_authority({
            "claims": [
                {"subject": "Our Lady of Lourdes", "predicate": "apparition_year", "value": "1858",
                 "authority_level": "VATICAN", "source": "vatican.va"},
                {"subject": "Our Lady of Lourdes", "predicate": "apparition_year", "value": "1854",
                 "authority_level": "COMMUNITY", "source": "blog.example"},
            ]
        }))
        self.assertEqual(res["resolution"]["preferred_value"], "1858")
        self.assertEqual(res["resolution"]["preferred_authority"], "VATICAN")

    # Proof 13: the worker remains safe, auditable, and review-gated.
    def test_13_safe_auditable_review_gated(self):
        # Review-gated self-improvement never auto-executes.
        p1 = patches.propose_code_patch({"request": {"title": "x"}, "affected_files": ["a.ts"]})
        p2 = patches.propose_schema_migration({"change": "add index", "affected_models": ["X"]})
        self.assertFalse(p1["safe_to_auto_execute"])
        self.assertFalse(p2["safe_to_auto_execute"])
        # Auditable: EVERY op returns the strict envelope contract via the
        # dispatcher (even on a missing-field error — one bad call never escapes
        # the contract), and the registry exposes the full unified op set.
        self.assertGreaterEqual(len(list_ops()), 130)
        for op in list_ops():
            resp = handle_request({"id": "proof", "op": op, "payload": {}})
            self.assertTrue(ENVELOPE_KEYS.issubset(resp), f"{op} not auditable envelope")
            self.assertEqual(resp["protocol_version"], 1)


if __name__ == "__main__":
    unittest.main()
