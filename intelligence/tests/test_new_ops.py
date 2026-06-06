"""Tests for the extraction, gaps, and learning operations."""

from __future__ import annotations

import unittest

from intelligence.operations import extraction, gaps, learning


class TestExtraction(unittest.TestCase):
    def test_extract_knowledge_finds_dates_names_citations(self):
        r = extraction.extract_knowledge(
            {
                "text": "Saint Augustine of Hippo was born in 354 and died in 430. "
                "He wrote Confessions. See Rom 5:8 and https://www.vatican.va/x",
            }
        )
        res = r["result"]
        self.assertIn("354", res["dates"])
        self.assertIn("430", res["dates"])
        self.assertTrue(any("Augustine" in n for n in res["names"]))
        self.assertIn("Rom 5:8", res["citations"])
        self.assertTrue(any("vatican.va" in s for s in res["sources"]))
        self.assertFalse(r["safe_to_auto_execute"])  # TS validates extracted data

    def test_extract_knowledge_never_invents_on_empty(self):
        r = extraction.extract_knowledge({"text": ""})
        self.assertEqual(r["result"]["names"], [])
        self.assertEqual(r["confidence"], 0.0)

    def test_suggest_structure_recommends_split_for_long_body(self):
        # >1200 chars across multiple paragraphs and no existing sections.
        body = "This is a substantial paragraph about the life of the saint.\n\n" * 50
        r = extraction.suggest_structure({"record": {"contentType": "SAINT", "body": body}})
        self.assertTrue(r["result"]["split_recommended"])
        self.assertIn("Sources", r["result"]["suggested_sections"])

    def test_detect_variants_structural_only(self):
        r = extraction.detect_variants({"title": "St. Thérèse of Lisieux"})
        forms = [c["form"] for c in r["result"]["candidate_variants"]]
        self.assertTrue(any(f.startswith("Saint") for f in forms))
        # It must flag that real variants need source verification.
        self.assertEqual(r["recommended_next_action"], "verify-variants-with-sources")
        self.assertFalse(r["safe_to_auto_execute"])


class TestGaps(unittest.TestCase):
    def test_detect_missing_flags_publish_blockers(self):
        r = gaps.detect_missing(
            {"record": {"contentType": "APPARITION", "title": "X", "body": "tiny", "sources": [], "citations": []}}
        )
        fields = {m["field"] for m in r["result"]["missing"]}
        self.assertIn("sources", fields)
        self.assertIn("citations", fields)
        self.assertLess(r["result"]["overall_completeness"], 0.5)

    def test_detect_missing_complete_record(self):
        r = gaps.detect_missing(
            {
                "record": {
                    "contentType": "PRAYER",
                    "title": "Hail Mary",
                    "summary": "A Marian prayer.",
                    "body": "Hail Mary full of grace. " * 20,
                    "slug": "hail-mary",
                    "sources": [{"authorityLevel": "VATICAN"}],
                    "citations": ["https://www.vatican.va/x"],
                }
            }
        )
        self.assertGreaterEqual(r["result"]["overall_completeness"], 0.99)


class TestLearning(unittest.TestCase):
    def test_negative_outcome_adjusts_down(self):
        r = learning.learn_from_outcome(
            {"outcome": {"type": "source_failure", "sourceHost": "bad.example", "contentType": "PRAYER"}}
        )
        adj = {a["target"]: a for a in r["result"]["adjustments"]}
        self.assertEqual(adj["source_reputation"]["direction"], "decrease")
        # failures raise attention on the content type
        self.assertEqual(adj["content_priority"]["direction"], "increase")
        self.assertEqual(r["result"]["outcome_class"], "negative")

    def test_admin_rejection_is_a_training_signal(self):
        r = learning.learn_from_outcome(
            {"outcome": {"type": "admin_correction", "contentType": "SAINT"}}
        )
        self.assertIn("admin", r["result"]["lesson"].lower())
        self.assertFalse(r["safe_to_auto_execute"])  # negatives escalate

    def test_success_reinforces_and_is_safe(self):
        r = learning.learn_from_outcome(
            {"outcome": {"type": "success", "sourceHost": "vatican.va", "contentType": "PRAYER"}}
        )
        self.assertEqual(r["result"]["outcome_class"], "positive")
        self.assertTrue(r["safe_to_auto_execute"])


if __name__ == "__main__":
    unittest.main()
