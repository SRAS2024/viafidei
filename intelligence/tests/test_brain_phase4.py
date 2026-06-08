"""
Tests for specialist reviewers, multi-layer memory, hybrid retrieval, Catholic
content extraction, and review-gated patches.
"""

import unittest

from intelligence.operations import (
    catholic_extraction,
    memory_layers,
    patches,
    retrieval,
    specialists,
)

ENVELOPE_KEYS = {
    "ok", "result", "confidence", "reasoning", "evidence",
    "sources_used", "risk_level", "recommended_next_action",
    "safe_to_auto_execute", "error",
}


def ok(r):
    assert ENVELOPE_KEYS.issubset(r), r
    assert r["ok"], r
    return r["result"]


class TestSpecialists(unittest.TestCase):
    def test_panel_runs_all_specialists(self):
        res = ok(
            specialists.specialist_reviews(
                {"candidate": {"contentType": "PRAYER", "finalScore": 0.7, "confidence": 0.8, "citationCount": 2}}
            )
        )
        self.assertEqual(len(res["reviews"]), 12)
        self.assertIn(res["decision"], ("proceed", "reconsider", "block-or-review"))

    def test_sensitive_uncited_routes_to_review(self):
        res = ok(
            specialists.specialist_reviews(
                {"candidate": {"contentType": "APPARITION", "finalScore": 0.7, "confidence": 0.8, "communionRisk": 0.5, "citationCount": 0}}
            )
        )
        self.assertTrue(res["blocking_specialists"])


class TestMemoryLayers(unittest.TestCase):
    def test_consolidate_groups_by_layer(self):
        res = ok(
            memory_layers.consolidate_memories(
                {"memories": [{"id": "1", "layer": "episodic", "text": "a"}, {"id": "2", "layer": "source", "text": "b"}]}
            )
        )
        self.assertEqual(res["layer_count"], 2)

    def test_merge_duplicate_memories(self):
        res = ok(
            memory_layers.merge_duplicate_memories(
                {"threshold": 0.5, "memories": [{"id": "1", "text": "blog failed to fetch"}, {"id": "2", "text": "blog failed fetch repeatedly"}]}
            )
        )
        self.assertEqual(res["merge_count"], 1)

    def test_extract_upgrade_seeds_from_self_memory(self):
        res = ok(
            memory_layers.extract_upgrade_requests_from_memory(
                {"memories": [{"id": "1", "layer": "self", "text": "need a PDF parser", "importance": 0.7}]}
            )
        )
        self.assertGreaterEqual(res["count"], 1)


class TestRetrieval(unittest.TestCase):
    def test_hybrid_search_prefers_authority_and_match(self):
        res = ok(
            retrieval.hybrid_search(
                {
                    "query": "hail mary prayer",
                    "candidates": [
                        {"id": "1", "text": "Hail Mary full of grace", "authorityLevel": "VATICAN", "citationCount": 2},
                        {"id": "2", "text": "unrelated text", "authorityLevel": "COMMUNITY"},
                    ],
                }
            )
        )
        self.assertEqual(res["matches"][0]["id"], "1")

    def test_detect_memory_gap(self):
        res = ok(
            retrieval.detect_memory_gap(
                {"query": "zzz obscure", "candidates": [{"id": "1", "text": "totally different words"}]}
            )
        )
        self.assertTrue(res["memory_gap"])


class TestCatholicExtraction(unittest.TestCase):
    def test_identify_encyclical(self):
        res = ok(catholic_extraction.identify_document_type({"text": "This encyclical letter teaches..."}))
        self.assertEqual(res["document_type"], "encyclical")

    def test_canon_reference(self):
        res = ok(catholic_extraction.extract_canon_law_reference({"text": "see canon 915 and canon 1247 § 2"}))
        self.assertEqual(res["count"], 2)

    def test_novena_nine_days(self):
        text = " ".join(f"day {w}" for w in ["one","two","three","four","five","six","seven","eight","nine"])
        res = ok(catholic_extraction.extract_novena_metadata({"text": text}))
        self.assertTrue(res["metadata"]["is_nine_days"])

    def test_timeline_entry_year(self):
        res = ok(catholic_extraction.build_church_history_timeline_entry({"text": "Council of Nicaea in 325."}))
        self.assertEqual(res["timeline_entry"]["year"], 325)


class TestPatches(unittest.TestCase):
    def test_all_patch_ops_are_review_gated(self):
        r1 = patches.propose_code_patch({"request": {"title": "x"}, "affected_files": ["a.ts"]})
        r2 = patches.propose_schema_migration({"change": "add index", "affected_models": ["X"]})
        r3 = patches.review_patch_risk({"patch": {"affected_models": ["X"], "affected_files": ["a", "b"]}})
        for r in (r1, r2, r3):
            self.assertFalse(r["safe_to_auto_execute"])
        # schema migration is high risk
        self.assertEqual(r2["risk_level"], "high")
        self.assertTrue(r1["result"]["proposal"]["requires_human_review"])

    def test_rollback_plan_for_schema(self):
        res = ok(patches.generate_rollback_plan({"patch": {"affected_models": ["X"]}}))
        self.assertTrue(res["schema_involved"])
        self.assertTrue(any("migration" in s.lower() for s in res["rollback_plan"]))


if __name__ == "__main__":
    unittest.main()
