"""
Tests for the unified self-model + deep code-awareness operations.

These replace the old summary-only ``analyze_code`` test. They prove the brain
can build a self-model, surface weak/untested/orphan/duplicate modules, rank its
own upgrades, explain its architecture, and detect stuckness — all returning the
strict envelope.
"""

import unittest

from intelligence.operations import self_model

CORPUS = {
    "files": [
        {
            "path": "src/lib/admin-worker/dispatcher.ts",
            "lines": 2100,
            "exports": ["executeMissionStage", "a", "b", "c", "d", "e"],
            "imports": ["src/lib/admin-worker/logs.ts"],
            "referencedByTests": True,
        },
        {
            "path": "src/lib/admin-worker/logs.ts",
            "lines": 120,
            "exports": ["writeAdminWorkerLog"],
            "imports": [],
            "referencedByTests": True,
        },
        {
            "path": "src/lib/admin-worker/orphan.ts",
            "lines": 200,
            "exports": ["unusedThing"],
            "imports": [],
            "referencedByTests": False,
        },
        {
            "path": "src/lib/content-shared/parish.ts",
            "lines": 60,
            "exports": ["resolveFilter", "applyFilter"],
            "imports": [],
            "referencedByTests": True,
        },
        {
            "path": "src/lib/content-shared/parish-copy.ts",
            "lines": 60,
            "exports": ["resolveFilter", "applyFilter"],
            "imports": [],
            "referencedByTests": False,
        },
        {"path": "src/x.test.ts", "lines": 40, "exports": [], "imports": [], "isTest": True},
    ],
    "routes": [{"path": "/prayers", "file": "prayers/page.tsx"}, {"path": "/ghost"}],
    "models": [{"name": "Prayer", "usedByFiles": 5}, {"name": "Unused", "usedByFiles": 0}],
    "scripts": ["dev", "test"],
    "stages": ["DISCOVERY", "PUBLIC_PUBLISH"],
    "brain_ops": ["select_action", "build_self_model"],
}

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


class TestSelfModel(unittest.TestCase):
    def _check_envelope(self, r):
        self.assertTrue(ENVELOPE_KEYS.issubset(r))
        self.assertTrue(r["ok"])
        self.assertTrue(0.0 <= r["confidence"] <= 1.0)

    def test_build_self_model_counts(self):
        r = self_model.build_self_model(CORPUS)
        self._check_envelope(r)
        res = r["result"]
        self.assertEqual(res["file_count"], 6)
        self.assertEqual(res["test_file_count"], 1)
        self.assertEqual(res["route_count"], 2)
        self.assertEqual(res["prisma_model_count"], 2)
        self.assertEqual(res["brain_op_count"], 2)
        self.assertGreater(res["total_lines"], 2000)

    def test_symbol_graph_flags_orphan(self):
        r = self_model.build_symbol_graph(CORPUS)
        self._check_envelope(r)
        self.assertIn("orphan_candidates", r["result"])

    def test_route_graph_flags_unowned_route(self):
        r = self_model.build_route_graph(CORPUS)
        self._check_envelope(r)
        self.assertIn("/ghost", r["result"]["orphan_routes"])

    def test_schema_graph_flags_unused_model(self):
        r = self_model.build_schema_graph(CORPUS)
        self._check_envelope(r)
        self.assertIn("Unused", r["result"]["unused_models"])

    def test_coverage_graph_ratio(self):
        r = self_model.build_test_coverage_graph(CORPUS)
        self._check_envelope(r)
        self.assertLess(r["result"]["coverage_ratio"], 1.0)
        self.assertIn("src/lib/admin-worker/orphan.ts", r["result"]["uncovered_modules"])

    def test_find_weak_modules_explains_and_plans(self):
        r = self_model.find_weak_modules(CORPUS)
        self._check_envelope(r)
        weak = r["result"]["weak_modules"]
        disp = next((w for w in weak if "dispatcher" in w["path"]), None)
        self.assertIsNotNone(disp)
        self.assertIn("oversized", disp["why"])
        self.assertTrue(disp["suggested_split"])
        self.assertFalse(r["safe_to_auto_execute"])  # refactors need review

    def test_find_untested_modules(self):
        r = self_model.find_untested_modules(CORPUS)
        self._check_envelope(r)
        paths = [u["path"] for u in r["result"]["untested_modules"]]
        self.assertIn("src/lib/admin-worker/orphan.ts", paths)

    def test_find_orphaned_code(self):
        r = self_model.find_orphaned_code(CORPUS)
        self._check_envelope(r)
        paths = [o["path"] for o in r["result"]["orphan_candidates"]]
        self.assertIn("src/lib/admin-worker/orphan.ts", paths)

    def test_find_duplicate_logic(self):
        r = self_model.find_duplicate_logic(CORPUS)
        self._check_envelope(r)
        self.assertGreaterEqual(r["result"]["pair_count"], 1)

    def test_rank_self_upgrades(self):
        weak = self_model.find_weak_modules(CORPUS)["result"]["weak_modules"]
        untested = self_model.find_untested_modules(CORPUS)["result"]["untested_modules"]
        r = self_model.rank_self_upgrades(
            {"weak_modules": weak, "untested_modules": untested, "coverage_ratio": 0.5}
        )
        self._check_envelope(r)
        self.assertGreaterEqual(r["result"]["upgrade_count"], 1)
        first = r["result"]["upgrades"][0]
        for key in ("title", "category", "problem", "evidence", "affected_files", "priority_score"):
            self.assertIn(key, first)

    def test_explain_own_architecture(self):
        model = self_model.build_self_model(CORPUS)["result"]
        r = self_model.explain_own_architecture({"model": model})
        self._check_envelope(r)
        layers = " ".join(r["result"]["layers"]).lower()
        self.assertIn("python", layers)
        self.assertIn("typescript", layers)
        self.assertIn("postgres", layers)

    def test_detect_stuckness_flags_loops(self):
        r = self_model.detect_stuckness(
            {
                "recent_decisions": [{"missionStage": "DISCOVERY"}] * 8,
                "recent_repairs": [{"kind": "FETCH_FAILED", "status": "FAILED"}] * 4,
                "published_delta": 0,
                "pass_count": 8,
                "source_fatigue": {"weak.example": 5},
            }
        )
        self._check_envelope(r)
        self.assertTrue(r["result"]["stuck"])
        self.assertTrue(len(r["result"]["signals"]) >= 2)

    def test_detect_stuckness_quiet_when_healthy(self):
        r = self_model.detect_stuckness(
            {
                "recent_decisions": [{"missionStage": "DISCOVERY"}, {"missionStage": "PUBLIC_PUBLISH"}],
                "recent_repairs": [],
                "published_delta": 5,
                "pass_count": 3,
                "source_fatigue": {},
            }
        )
        self._check_envelope(r)
        self.assertFalse(r["result"]["stuck"])


if __name__ == "__main__":
    unittest.main()
