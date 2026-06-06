"""Tests for intelligence.core primitives and intelligence.contracts."""

from __future__ import annotations

import unittest

from intelligence.contracts import (
    RISK_CRITICAL,
    RISK_HIGH,
    RISK_LOW,
    RISK_NONE,
    default_safety,
    envelope,
    error_envelope,
    max_risk,
    risk_from_score,
)
from intelligence.core import (
    Belief,
    Budget,
    clamp,
    cosine,
    jaccard,
    levenshtein,
    normalize_text,
    slugify,
    sparse_embed,
    str_ratio,
    strip_accents,
    token_set,
)


class TestEmbeddings(unittest.TestCase):
    def test_embedding_is_deterministic(self):
        a = sparse_embed("Hail Mary full of grace")
        b = sparse_embed("Hail Mary full of grace")
        self.assertEqual(a, b)

    def test_embedding_is_l2_normalised(self):
        vec = sparse_embed("the quick brown fox the fox")
        norm = sum(v * v for v in vec.values()) ** 0.5
        self.assertAlmostEqual(norm, 1.0, places=6)

    def test_cosine_identity_and_orthogonality(self):
        a = sparse_embed("alpha beta gamma")
        self.assertAlmostEqual(cosine(a, a), 1.0, places=6)
        # Hash embeddings carry some collision noise (no shared words can
        # still hash to the same dim), so "orthogonal" means low, not zero.
        b = sparse_embed("completely unrelated vocabulary tokens")
        self.assertLess(cosine(a, b), 0.5)

    def test_cosine_related_beats_unrelated(self):
        q = sparse_embed("prayer to the blessed virgin mary")
        related = sparse_embed("a marian prayer to the blessed virgin")
        unrelated = sparse_embed("instructions for assembling furniture")
        self.assertGreater(cosine(q, related), cosine(q, unrelated))


class TestTextHelpers(unittest.TestCase):
    def test_strip_accents(self):
        self.assertEqual(strip_accents("Thérèse"), "Therese")

    def test_normalize_text(self):
        self.assertEqual(normalize_text("  Saint  THÉRÈSE \n"), "saint therese")

    def test_slugify(self):
        self.assertEqual(slugify("Saint Thérèse of Lisieux"), "saint-therese-of-lisieux")

    def test_levenshtein(self):
        self.assertEqual(levenshtein("kitten", "sitting"), 3)
        self.assertEqual(levenshtein("same", "same"), 0)

    def test_str_ratio(self):
        self.assertEqual(str_ratio("abc", "abc"), 1.0)
        self.assertTrue(0.0 < str_ratio("abc", "abd") < 1.0)

    def test_jaccard(self):
        self.assertEqual(jaccard({"a", "b"}, {"a", "b"}), 1.0)
        self.assertEqual(jaccard({"a"}, {"b"}), 0.0)
        self.assertAlmostEqual(jaccard({"a", "b"}, {"b", "c"}), 1 / 3)

    def test_token_set_folds_accents(self):
        self.assertIn("therese", token_set("Thérèse, pray for us"))


class TestScalars(unittest.TestCase):
    def test_clamp(self):
        self.assertEqual(clamp(-1), 0.0)
        self.assertEqual(clamp(2), 1.0)
        self.assertEqual(clamp(0.5), 0.5)

    def test_budget_limits(self):
        b = Budget(max_steps=2, max_seconds=100, max_tool_calls=1)
        self.assertTrue(b.allow_step())
        b.steps = 2
        self.assertFalse(b.allow_step())
        self.assertFalse(b.allow_tool() and b.tool_calls >= 1)

    def test_belief_update_moves_toward_signal(self):
        b = Belief(key="k", value="v", confidence=0.5)
        up = b.update(1.0, "evidence")
        self.assertGreater(up.confidence, b.confidence)
        self.assertIn("evidence", up.evidence)


class TestContracts(unittest.TestCase):
    def test_envelope_clamps_and_defaults(self):
        e = envelope(result={"x": 1}, confidence=2.0, reasoning="r")
        self.assertEqual(e["confidence"], 1.0)
        self.assertEqual(e["risk_level"], RISK_LOW)
        self.assertIn("safe_to_auto_execute", e)

    def test_default_safety(self):
        self.assertTrue(default_safety(0.9, RISK_LOW))
        self.assertFalse(default_safety(0.5, RISK_LOW))
        self.assertFalse(default_safety(0.99, RISK_HIGH))

    def test_max_risk(self):
        self.assertEqual(max_risk(RISK_LOW, RISK_HIGH, RISK_NONE), RISK_HIGH)

    def test_risk_from_score(self):
        self.assertEqual(risk_from_score(0.9), RISK_CRITICAL)
        self.assertEqual(risk_from_score(0.0), RISK_NONE)

    def test_error_envelope_never_auto_executes(self):
        e = error_envelope("boom")
        self.assertFalse(e["ok"])
        self.assertFalse(e["safe_to_auto_execute"])
        self.assertEqual(e["error"], "boom")


if __name__ == "__main__":
    unittest.main()
